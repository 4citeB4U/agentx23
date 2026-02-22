"""
LoRA Adapter Fine-Tuning Trainer — Agent Lee v4
═══════════════════════════════════════════════
Reads synthetic.jsonl from workspace/ and fine-tunes LoRA adapters
for each domain when retrain eligibility is confirmed via /retrain/status.

Usage:
    python scripts/lora_trainer.py --domain code --epochs 3 --output workspace/adapters/

Dependencies (install when ready):
    pip install peft transformers datasets bitsandbytes accelerate
"""

import argparse
import json
import os
import sys

SYNTH_PATH   = os.path.join(os.path.dirname(__file__), "..", "workspace", "synthetic.jsonl")
ADAPTER_PATH = os.path.join(os.path.dirname(__file__), "..", "workspace", "adapters")


def load_synthetic_corpus(domain: str | None = None) -> list:
    """Load synthetic episodes from JSONL, optionally filtered by domain."""
    if not os.path.exists(SYNTH_PATH):
        print(f"[lora_trainer] No synthetic corpus at {SYNTH_PATH}")
        return []
    records = []
    with open(SYNTH_PATH) as f:
        for line in f:
            try:
                rec = json.loads(line.strip())
                if domain and rec.get("domain") != domain:
                    continue
                records.append(rec)
            except json.JSONDecodeError:
                continue
    print(f"[lora_trainer] Loaded {len(records)} records (domain={domain or 'all'})")
    return records


def format_for_training(records: list) -> list[dict]:
    """Convert episode records to instruction-tuning format."""
    samples = []
    for rec in records:
        so = rec.get("structured_output", {})
        prompt = (rec.get("input_payload") or {}).get("prompt", "")
        answer = so.get("final_answer", "")
        if prompt and answer:
            samples.append({
                "instruction": prompt,
                "output": json.dumps(so, ensure_ascii=False),
            })
    return samples


def train(domain: str, epochs: int, output_dir: str):
    """
    Placeholder training loop.
    Replace with actual PEFT/LoRA training when GPU resources are available.
    """
    records = load_synthetic_corpus(domain)
    samples = format_for_training(records)

    if len(samples) < 10:
        print(f"[lora_trainer] Insufficient samples ({len(samples)}) for domain '{domain}'. "
              f"Need at least 10. Run more episodes or synthetic expansion first.")
        sys.exit(1)

    print(f"[lora_trainer] Would train LoRA adapter for domain='{domain}' "
          f"with {len(samples)} samples over {epochs} epoch(s).")
    print(f"[lora_trainer] Output would go to: {output_dir}/{domain}/")
    print("[lora_trainer] STUB — install peft + transformers to enable real training.")

    # --- Real training scaffold (uncomment when GPU available) ---
    # from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments
    # from peft import LoraConfig, get_peft_model, TaskType
    # from datasets import Dataset
    #
    # model_id = os.getenv("QWEN_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    # tokenizer = AutoTokenizer.from_pretrained(model_id)
    # model = AutoModelForCausalLM.from_pretrained(model_id, load_in_4bit=True)
    # lora_config = LoraConfig(task_type=TaskType.CAUSAL_LM, r=16, lora_alpha=32,
    #                          target_modules=["q_proj", "v_proj"], lora_dropout=0.05)
    # model = get_peft_model(model, lora_config)
    # dataset = Dataset.from_list(samples)
    # ... TrainingArguments + Trainer.train() ...
    # model.save_pretrained(f"{output_dir}/{domain}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agent Lee LoRA Trainer")
    parser.add_argument("--domain",  default="general", help="Domain to train (general/code/ui/cdl)")
    parser.add_argument("--epochs",  type=int, default=3, help="Training epochs")
    parser.add_argument("--output",  default=ADAPTER_PATH, help="Output directory")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)
    train(args.domain, args.epochs, args.output)
