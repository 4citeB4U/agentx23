import { ChatOpenAI } from "@langchain/openai";
    import * as dotenv from 'dotenv';
    import * as fs from 'fs/promises';
    import * as sqlite3 from 'sqlite3';
    import { open } from 'sqlite';
    import nodemailer from 'nodemailer';
    import axios from 'axios';

    dotenv.config();

    // Initialize SQLite database
    async function initDatabase() {
      const db = await open({
        filename: 'memory.db',
        driver: sqlite3.Database
      });
      await db.exec(`
        CREATE TABLE IF NOT EXISTS memory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          value TEXT
        )
      `);
      return db;
    }

    // Memory functions
    async function saveToMemory(db, key, value) {
      await db.run('INSERT INTO memory (key, value) VALUES (?, ?)', [key, value]);
    }

    async function loadFromMemory(db, key) {
      const row = await db.get('SELECT value FROM memory WHERE key = ?', [key]);
      return row ? row.value : null;
    }

    // Email function
    async function sendEmail(to, subject, text) {
      const transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email service
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }

    // Function to interact with n8n workflow
    async function runN8nWorkflow(query) {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      if (!n8nWebhookUrl) {
        console.error("N8N_WEBHOOK_URL not set in .env");
        return null;
      }

      try {
        const response = await axios.post(n8nWebhookUrl, { query: query });
        return response.data; // Assuming n8n returns the result in the data field
      } catch (error) {
        console.error('Error calling n8n workflow:', error);
        return null;
      }
    }

    async function main() {
      const db = await initDatabase();

      const llm = new ChatOpenAI({
        modelName: "gpt-4o",
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Example usage:
      const initialTask = "Send a test email.";
      if (initialTask.includes("email")) {
        await sendEmail("YOUR_EMAIL_ADDRESS", "Test Email", "This is a test email from your AI.");
      }

      // Example of RAG using n8n:
      const ragQuery = "What are the latest advancements in AI?";
      const ragResult = await runN8nWorkflow(ragQuery);

      if (ragResult) {
        console.log("RAG Result from n8n:", ragResult);
        await saveToMemory(db, 'ai_advancements', JSON.stringify(ragResult));
      }

      // Example of retrieving from memory:
      const retrievedInfo = await loadFromMemory(db, 'ai_advancements');
      if (retrievedInfo) {
        console.log("Retrieved AI advancements:", JSON.parse(retrievedInfo));
      }

      await db.close();
    }

    main();
