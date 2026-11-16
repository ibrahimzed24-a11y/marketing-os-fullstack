# N8N Setup & Workflow Import Guide

This guide details how to launch n8n, import the Marketing OS task workflows, set environment keys, and activate workflows.

---

## 1. Starting n8n Locally

Run n8n in a separate terminal:
```bash
# Recommended command (handles package resolution cleanly):
npx --legacy-peer-deps n8n start

# Or install globally first if preferred:
npm install -g n8n
n8n start
```

Once running, the n8n editor is accessible at:  
👉 **http://localhost:5678** (or **http://127.0.0.1:5678**)

---

## 2. Setting Environment Variables in n8n

Ensure n8n has access to Marketing OS callback credentials:
- When starting via terminal, you can export them directly:
```bash
export OS_API_URL=http://127.0.0.1:3000
export OS_API_KEY=local-dev-key-change-me
npx --legacy-peer-deps n8n start
```

Or configure environment variables in your global n8n config (`~/.n8n/config` or `.env`).

---

## 3. Importing the Workflows

1. Open **http://localhost:5678** in your browser.
2. In the left navigation menu, click **Workflows**.
3. In the top right corner, click the **Add Workflow** button (or the three dots `...`) and select **Import from File**.
4. Import the workflows from your project directory:
   - `n8n-workflows/01-main-task-router.json` (Main Task Router)
   - `n8n-workflows/02-landing-page-factory.json` (Landing Page Factory)
   - `n8n-workflows/03-lead-research.json` (Lead Research)

---

## 4. Activating Workflow 01 (Main Task Router)

1. Open **Marketing OS - Main Task Router**.
2. Verify the Webhook node path is set to:  
   `marketing-os-task`  
   (This creates `POST http://127.0.0.1:5678/webhook/marketing-os-task`)
3. In the top right corner of the workflow editor, toggle the switch from **Inactive** to **Active (ON)**.
4. Click **Save** (`Cmd+S` or `Ctrl+S`).

---

## 5. Verification

Run the Marketing OS diagnostic tool to confirm connection:
```bash
node fix/diagnose.js
```
Expected output:
```
[OK]   n8n Service        : Running at http://127.0.0.1:5678 (HTTP 200)
[OK]   n8n Task Webhook   : Active at http://127.0.0.1:5678/webhook/marketing-os-task
```
When n8n is offline or undergoing maintenance, Marketing OS will automatically and seamlessly fall back to local agent execution so the factory never blocks.
