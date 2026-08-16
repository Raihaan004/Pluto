# Pluto 🚀

**Pluto** is an enterprise-grade platform for modeling, managing, and executing Functional Safety (FuSa) processes compliant with standards like ISO 26262. It bridges high-level process architecture with execution-level project management, offering visual flowcharting, multi-sheet workspace management, version control, automated Jira integration, and role-based access control.

---

## 📸 Overview

![Pluto Dashboard Banner](frontend/public/D-D.png)

Pluto allows safety engineers and project managers to design standardized safety lifecycle processes, create versioned templates, instantiate active projects, assign collaborators, and synchronize engineering tasks directly into Atlassian Jira.

---

## ✨ Key Features

### 🎨 1. Visual Process & Table Canvas
- **React Flow Visual Builder**: Drag-and-drop workflow designer supporting node connections, auto-alignments, and custom styling.
- **ISO 26262 FuSa Node Types**:
  - **Work Product (Blue)**: Deliverables, safety artifacts, and documentation outputs.
  - **Activity (Yellow)**: Engineering tasks, analysis steps, and hazard evaluations.
  - **Decision (Orange)**: Gateway logic and branch conditions.
  - **Process (Green)**: Sub-process references and nested lifecycle stages.
  - **Document (Cyan)**: Input standard requirements and technical specs.
- **Swimlanes & Layouts**: Horizontal/vertical swimlanes to organize activities across functional groups or safety lifecycle phases.
- **Multi-Sheet Workspaces**: Support for multi-tab process architectures (e.g., Parent Process, Child Sub-processes, Work Sheets).
- **Dual Viewmodes**: Switch between **Freestyle Flowchart** and **Structured Table View** seamlessly.

### 📜 2. Versioning & Governance
- **Version Control**: Create immutable snapshots when publishing processes (`v1.0`, `v1.1`, etc.) with change logs and comments.
- **Draft vs. Published States**: Work safely on draft revisions without affecting active project templates.
- **Project Instantiation**: Clone published process versions into live project instances for execution.

### 👥 3. Collaboration & Access Control
- **Role-Based Access Control (RBAC)**: Fine-grained user permissions:
  - `Admin`: Full system configuration, user role management, process/project deletion, and system settings.
  - `Editor`: Process/project creation, editing, and publishing.
  - `Viewer`: Read-only access to published processes and active project canvases.
- **Collaborator Management**: Add and manage project-specific collaborators with custom permission levels (`owner`, `editor`, `viewer`).

### 🔗 4. Automated Jira Integration
- **Automated Ticket Creation**: Trigger Jira ticket creation upon publishing a process.
- **Connection Triggers**: Automatically create linked Jira tickets when an Activity node connects to a Work Product node.
- **Jira Configuration**: Global configuration panel in Settings for Jira URL, API Token, Email, and Project Key.

### 💾 5. Data Export & Backup Management
- **Full System Backup**: Export all project definitions, process sheets, and metadata into a timestamped `.zip` archive (`/export-backup`).
- **Canvas Image Export**: High-resolution PNG exports of process diagrams for audit logs and compliance documentation.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | [Next.js 14+](https://nextjs.org/) (App Router) | React Framework & SSR |
| | [React 18](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/) | UI Logic & Type Safety |
| | [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/) | Modern UI Styling & Design Tokens |
| | [React Flow](https://reactflow.dev/) | Interactive Flowchart Canvas |
| | [Clerk](https://clerk.com/) | User Authentication & Session Management |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+) | High-performance Async REST API |
| | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) | Database ORM & Abstraction Layer |
| | [Pydantic v2](https://docs.pydantic.dev/) | Schema Validation & Data Serialization |
| **Database** | [PostgreSQL](https://www.postgresql.org/) / [SQLite](https://sqlite.org/) | Relational storage (auto SQLite fallback) |
| **DevOps** | [Docker](https://www.docker.com/) & Docker Compose | Containerization & Orchestration |

---

## 📁 Repository Structure

```text
Pluto/
├── backend/                    # Python FastAPI Server
│   ├── main.py                 # Core API endpoints & middleware
│   ├── models.py               # SQLAlchemy ORM models & Pydantic schemas
│   ├── database.py             # Database engine & Session setup
│   ├── database_setup.sql      # PostgreSQL DDL setup script for Supabase
│   ├── jira_utils.py           # Atlassian Jira API integration helpers
│   ├── cli.py                  # Command-line utility for system monitoring
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile              # Backend container configuration
├── frontend/                   # Next.js Application
│   ├── app/                    # Next.js App Router (pages & layouts)
│   │   ├── page.tsx            # Landing page
│   │   ├── setup/              # Setup redirect page
│   │   └── dashboard/          # Main application dashboard
│   │       ├── admin/          # Admin console (user & access management)
│   │       ├── process/        # Process modeling & canvas views
│   │       ├── projects/       # Active project management
│   │       └── settings/       # System & Jira settings
│   ├── components/             # Reusable UI components & custom React Flow nodes
│   ├── context/                # React Contexts (UserRole, Process, Canvas)
│   ├── hooks/                  # Custom React hooks
│   └── Dockerfile              # Frontend container configuration
├── docker-compose.yml          # Multi-container orchestration
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for containerized setup)
- [Node.js 18+](https://nodejs.org/) (for manual frontend development)
- [Python 3.11+](https://www.python.org/) (for manual backend development)

---

### Option A: Running with Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Raihaan004/Pluto.git
   cd Pluto
   ```

2. **Configure Environment Variables**:
   Create environment files for both backend and frontend services.

   **`backend/.env`**:
   ```env
   DATABASE_URL=postgresql://postgres:plutopass@localhost:5432/plutodb
   FRONTEND_URL=http://localhost:3000
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_KEY=your_supabase_anon_key

   # Jira Configuration (Optional)
   JIRA_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your_jira_api_token
   JIRA_PROJECT_KEY=PLUTO
   ```

   **`frontend/.env.local`**:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard/projects
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard/projects
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. **Start the application**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Local Manual Setup

#### 1. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn main:app --reload --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

---

## 💻 CLI Management Tool

The backend includes a command-line interface (`backend/cli.py`) for system health, log viewing, and configuration management.

```bash
# Check connectivity and service status
python cli.py status

# Display backend configuration
python cli.py config show

# View running backend process usage
python cli.py process

# Fetch recent API performance metrics
python cli.py metrics --limit 10
```

---

## 🗄️ Database Architecture

Pluto uses SQLAlchemy ORM models with integer auto-incrementing primary keys compatible with PostgreSQL and SQLite:

- **`users`**: User profiles, roles (`admin`, `editor`, `viewer`), approval status, and verification state.
- **`pending_users`**: Staging area for user approval workflows.
- **`instance_settings`**: Local system configurations, organization details, and Jira settings.
- **`processes`**: Canvas definitions, version snapshots, nodes, edges, swimlanes, and sheet data.
- **`projects`**: Instantiated process execution instances with progress metrics and collaborators.
- **`notifications`**: System event logs and error tracking entries.

---

## 🛡️ License

Distributed under the **MIT License**. See `LICENSE` for details.
