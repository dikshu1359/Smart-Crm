# EduSync CRM — Smart Institutional Management System

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**EduSync CRM** is a modern, high-performance multi-tenant Institutional CRM tailored for schools, universities, and coaching institutes. It features tenant database isolation, role-based access control (Admin, Teacher, Student), automated attendance tracking, marks spreadsheet calculation, assignment management, quiz engines, real-time communications, and printable official student dossiers.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Pre-Seeded Demo Credentials](#-pre-seeded-demo-credentials)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start (Local Development)](#-quick-start-local-development)
- [Environment Variables](#-environment-variables)
- [Deployment Guide](#-deployment-guide)
  - [Deploy to Vercel (Serverless Full-Stack)](#option-a-deploy-to-vercel)
  - [Deploy to Railway / Render / Docker (Persistent Server)](#option-b-deploy-to-railway--render--docker)
- [Project Structure](#-project-structure)
- [Testing & Verification](#-testing--verification)
- [License](#-license)

---

## ✨ Key Features

### 🏢 Multi-Tenant Institution Architecture
- **Tenant Isolation**: Dynamic database separation per institution (`smart_crm_<tenant>_<timestamp>`).
- **Master Institution Registry**: Self-service registration and administrative oversight across campus codes.
- **Resilient Dual-Mode Database**: Operates with live MongoDB Atlas or automatically falls back to a zero-latency in-memory data store if MongoDB is offline.

### 👥 Role-Based Portals (RBAC)
- **Institution Admin**:
  - Faculty & student account administration
  - Course and division roster imports (CSV / Excel format)
  - Centralized faculty attendance monitoring & analytics
  - Academic calendar scheduling & campus-wide notice broadcasting
  - Audit trail viewer with IP and mutation activity tracking
- **Faculty / Teacher Portal**:
  - Daily student attendance logging with instant status summaries
  - Dynamic assignment creation with attachment distribution
  - Timed quiz builder with automated grading and pass/fail thresholds
  - Marks spreadsheet with batch entry, percentage formulas, and grade assignment
  - Student roster inspection & direct messaging
- **Student Portal**:
  - Personal student dashboard & attendance percentage tracker
  - Assignment submission hub with teacher feedback & grading history
  - Interactive quiz runner with instant result breakdown
  - Verified marks statement & printable academic dossier
  - Direct communication with subject teachers

### 📊 Advanced Academic Tools
- **Marks Spreadsheet**: Real-time formula computation (Internals + Assignments + Exams = Total, Percentage, Letter Grade).
- **Official Student Dossier**: Browser print-optimized A4 student report card with signatures, photo credentials, and academic standing.
- **Roster CSV Importer**: Batch import students into classes with automated ID generation.
- **Direct Messaging**: Intra-institution communication between students, teachers, and admins.

---

## 🏛 System Architecture

```text
                  +--------------------------------+
                  |         Vite + React 19        |
                  |  Tailwind CSS • Lucide • Recharts  |
                  +---------------+----------------+
                                  |
                                  | Relative /api/* requests
                                  v
+--------------------------------------------------------------------+
|                      Express Application Layer                     |
|                                                                    |
|  /api/auth       /api/classes       /api/assignments    /api/marks |
|  /api/attendance /api/quizzes       /api/notices        /api/audit |
|  /api/schedule   /api/calendar      /api/analytics      /api/calls |
+---------------------------------+----------------------------------+
                                  |
                 +----------------+----------------+
                 |                                 |
                 v                                 v
   +---------------------------+     +---------------------------+
   |   MongoDB Atlas (Live)    |     | In-Memory Resilient Store |
   |  (when MONGODB_URI is set)|     |   (zero-config fallback)  |
   +---------------------------+     +---------------------------+
```

---

## 🔑 Pre-Seeded Demo Credentials

The platform includes ready-to-use demo accounts for **Vidyavardhini College of Engineering & Technology (VCET)**:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `vcetadmin` | `admin123` | Full institution management & roster import |
| **Teacher** | `jdoe` | `teacher123` | Operating Systems faculty (Dr. Anita Desai) |
| **Teacher** | `rkumar` | `teacher123` | Database Systems faculty (Prof. Rakesh Kumar) |
| **Student** | `cs101_rahul` | `student123` | Roll No: CS-101 (Rahul Deshmukh) |
| **Student** | `cs102_priya` | `student123` | Roll No: CS-102 (Priya Patel) |
| **Student** | `cs103_amit` | `student123` | Roll No: CS-103 (Amit Verma) |

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide React, Recharts, Motion, jsPDF
- **Backend**: Node.js 22, Express 4, JSON Web Tokens (JWT), bcryptjs, Mongoose 9
- **Database**: MongoDB Atlas (with built-in resilient in-memory fallback engine)
- **Deployment**: Vercel Serverless Functions (`/api/index.js`), Docker, or Node.js server (`server.ts`)

---

## 📋 Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **MongoDB Atlas** *(Optional)*: A free cluster URI from MongoDB Atlas

---

## 🚀 Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/dikshu1359/Smart-Crm.git
cd Smart-Crm
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Populate `.env` with your values:
```env
BACKEND_PORT=5001
JWT_SECRET=your-super-secret-jwt-key
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
```
*(Note: If you do not provide `MONGODB_URI`, the application will seamlessly boot in In-Memory Demo Mode).*

### 4. Run the full-stack development server
```bash
npm run dev
```
Open your browser at **`http://localhost:3000`**.

---

## ⚙️ Environment Variables

| Variable | Required | Description |
| :--- | :---: | :--- |
| `MONGODB_URI` | No | MongoDB Atlas connection string. If omitted, uses the resilient in-memory database. |
| `JWT_SECRET` | Yes | Secret key used to sign and verify authentication tokens. |
| `VITE_API_URL` | No | Optional API base URL. **Leave blank on Vercel** (defaults to relative `/api`). |
| `BACKEND_PORT`| No | Local backend port (default: `5001`). |

---

## 🌐 Deployment Guide

### Option A: Deploy to Vercel

This repository is pre-configured for Vercel with:
- Client compilation via `vite build` into `dist/`
- API routes served through Vercel Serverless Functions (`/api/index.js`)
- `vercel.json` routing configuration

#### Step-by-step:
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "feat: prepare production release"
   git push origin main
   ```
2. **Import Project to Vercel**:
   - Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
   - Select your GitHub repository (`Smart-Crm`).
   - Framework Preset: **Vite** (detected automatically).
   - Root Directory: `./`.
3. **Configure Environment Variables in Vercel**:
   - In Project Settings > Environment Variables, add:
     - `MONGODB_URI`: Your MongoDB Atlas URI.
     - `JWT_SECRET`: A secure random secret string.
     - *(Do NOT add `VITE_API_URL` so frontend calls `/api` relatively on the same domain).*
4. **Deploy**:
   - Click **Deploy**. Vercel will install dependencies cleanly from `package-lock.json` and build the application.

---

### Option B: Deploy to Railway / Render / Docker

If you need a persistent Node.js server (with long-lived WebSockets):

1. **Build & Start Commands**:
   - Build command: `npm run build`
   - Start command: `npm run start` (or `node server.ts`)
2. **Exposed Port**: `3000`
3. **Environment Variables**:
   - Set `NODE_ENV=production`
   - Set `PORT=3000`
   - Set `MONGODB_URI` and `JWT_SECRET`

---

## 📁 Project Structure

```text
├── api/
│   └── index.js                   # Vercel Serverless Function entry point
├── backend/
│   ├── middleware/                # JWT tenant auth & activity audit logger
│   ├── models/                    # Data models & schemas
│   ├── routes/                    # REST API routes (auth, marks, attendance, etc.)
│   ├── utils/DatabaseManager.js   # Dual-mode (Atlas / In-Memory) DB engine
│   ├── websocket.js               # WebSocket server implementation
│   └── server.js                  # Express backend application instance
├── src/
│   ├── assets/                    # Branding assets & logos
│   ├── components/                # Modular CRM views (Marks, Roster, Quizzes, etc.)
│   ├── context/AppContext.tsx     # Global state management & tenant session
│   ├── pages/                     # Landing & Role Selection screens
│   ├── services/api.ts            # Centralized API service client
│   ├── types/crm.ts               # TypeScript data interfaces
│   └── utils/exportProfilePdf.ts  # PDF generation utility
├── test_features.js               # Automated 10-suite integration test runner
├── vercel.json                    # Vercel deployment rewrites configuration
├── server.ts                      # Full-stack dev & persistent production server
├── package.json                   # Dependencies & scripts
└── vite.config.ts                 # Vite bundler configuration
```

---

## 🧪 Testing & Verification

Run the full integration test suite against the backend API:

```bash
# Verify TypeScript typing
npm run lint

# Test production compilation
npm run build

# Run end-to-end CRM verification (Classes, Quizzes, Marks, Attendance, RBAC)
node test_features.js
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
