"""
scripts/train_lora.py — Agent Lee LoRA Continual Training (PEFT)
Reads workspace/synthetic.jsonl, fine-tunes Qwen base model with LoRA,
saves adapter weights to workspace/lora_adapters/<domain>/.

Requirements:
    pip install transformers peft datasets torch accelerate bitsandbytes

Usage:
    python scripts/train_lora.py [--domain cdl] [--epochs 3] [--rank 16]
"""

import os
import json
import argparse
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent.parent
SYNTH_PATH   = BASE_DIR / "workspace" / "synthetic.jsonl"
ADAPTER_BASE = BASE_DIR / "workspace" / "lora_adapters"
ADAPTERS_REG = BASE_DIR / "workspace" / "adapters.json"
BASE_MODEL   = os.getenv("QWEN_MODEL_HF", "Qwen/Qwen2.5-7B-Instruct")  # HF model id


def load_synthetic(domain: str | None) -> list[dict]:
    if not SYNTH_PATH.exists():
        raise FileNotFoundError(f"No synthetic data file at {SYNTH_PATH}. Run synthetic_job.py first.")
    records = []
    with SYNTH_PATH.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if domain is None or rec.get("domain") == domain:
                records.append(rec)
    if not records:
        raise ValueError(f"No synthetic records found for domain={domain!r}")
    return records


def train(domain: str, epochs: int, rank: int, lr: float):
    # Deferred imports — heavy ML deps only loaded at training time
    try:
        import torch
        from datasets import Dataset
        from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments
        from peft import get_peft_model, LoraConfig, TaskType
        from trl import SFTTrainer
    except ImportError as e:
        print(f"[lora] Missing dependency: {e}")
        print("  Install with: pip install transformers peft datasets torch accelerate trl bitsandbytes")
        return

    print(f"[lora] Loading synthetic data (domain={domain!r}) ...")
    records = load_synthetic(domain)
    print(f"[lora] {len(records)} records loaded")

    # Format for instruction fine-tuning
    def format_record(rec):
        instruction = rec.get("instruction", "")
        output      = rec.get("output", "")
        return {"text": f"### Instruction:\n{instruction}\n\n### Response:\n{output}</s>"}

    dataset = Dataset.from_list([format_record(r) for r in records])

    print(f"[lora] Loading base model: {BASE_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=rank,
        lora_alpha=rank * 2,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    adapter_out = ADAPTER_BASE / domain
    adapter_out.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(adapter_out / "checkpoints"),
        num_train_epochs=epochs,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=lr,
        fp16=True,
        logging_steps=10,
        save_strategy="epoch",
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        tokenizer=tokenizer,
        args=training_args,
        dataset_text_field="text",
        max_seq_length=1024,
    )

    print(f"[lora] Starting training ({epochs} epochs, rank={rank}, lr={lr}) ...")
    trainer.train()

    print(f"[lora] Saving adapter → {adapter_out}")
    model.save_pretrained(str(adapter_out))
    tokenizer.save_pretrained(str(adapter_out))

    # Update adapters.json registry
    if ADAPTERS_REG.exists():
        reg = json.loads(ADAPTERS_REG.read_text(encoding="utf-8"))
    else:
        reg = {"adapters": {}, "_meta": {"version": "1.0"}}

    reg["adapters"][domain] = {
        "path": str(adapter_out),
        "description": f"{domain.title()} domain LoRA adapter",
        "active": True,
        "trained_at": __import__("datetime").datetime.utcnow().isoformat(),
        "records": len(records),
        "rank": rank,
    }
    ADAPTERS_REG.write_text(json.dumps(reg, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[lora] Registry updated: {ADAPTERS_REG}")
    print("[lora] Training complete. Restart brain server (server.py) to pick up new adapter.")


def main():
    parser = argparse.ArgumentParser(description="Agent Lee LoRA Continual Trainer")
    parser.add_argument("--domain", type=str, default="general", help="Domain to train (cdl|drone|code|general)")
    parser.add_argument("--epochs", type=int, default=3,          help="Training epochs")
    parser.add_argument("--rank",   type=int, default=16,         help="LoRA rank (r)")
    parser.add_argument("--lr",     type=float, default=2e-4,     help="Learning rate")
    args = parser.parse_args()

    print(f"[lora] Agent Lee LoRA Trainer v1")
    print(f"  domain={args.domain}  epochs={args.epochs}  rank={args.rank}  lr={args.lr}")
    train(args.domain, args.epochs, args.rank, args.lr)


if __name__ == "__main__":
    main()
