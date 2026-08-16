import os
import sys
import argparse
import requests
import psutil
import time
from dotenv import load_dotenv, set_key, find_dotenv
from supabase import create_client, Client

# Load environment variables
dotenv_path = find_dotenv()
load_dotenv(dotenv_path)

# Utility colors for CLI
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def get_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception:
        return None

def check_connectivity():
    print(f"\n{Colors.HEADER}=== System Connectivity Check ==={Colors.ENDC}")
    
    # 1. Backend (Self check)
    backend_url = "http://localhost:8000"
    try:
        res = requests.get(f"{backend_url}/docs", timeout=2)
        if res.status_code == 200:
            print(f"{Colors.OKGREEN}[✓] Backend (Self): Operational at {backend_url}{Colors.ENDC}")
        else:
            print(f"{Colors.WARNING}[!] Backend (Self): Responded with {res.status_code}{Colors.ENDC}")
    except requests.exceptions.RequestException:
        print(f"{Colors.FAIL}[✗] Backend (Self): Not responding at {backend_url}{Colors.ENDC}")

    # 2. Frontend
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    try:
        res = requests.get(frontend_url, timeout=2)
        if res.status_code == 200:
            print(f"{Colors.OKGREEN}[✓] Frontend: Operational at {frontend_url}{Colors.ENDC}")
        else:
            print(f"{Colors.WARNING}[!] Frontend: Responded with {res.status_code}{Colors.ENDC}")
    except requests.exceptions.RequestException:
        print(f"{Colors.FAIL}[✗] Frontend: Not responding at {frontend_url}{Colors.ENDC}")

    # 3. Supabase
    sb_url = os.getenv("SUPABASE_URL")
    if sb_url:
        try:
            res = requests.get(f"{sb_url}/rest/v1/", timeout=5)
            if res.status_code in [200, 401]: # 401 is expected if no key in headers but URL is reachable
                print(f"{Colors.OKGREEN}[✓] Supabase: Connected to {sb_url}{Colors.ENDC}")
            else:
                print(f"{Colors.WARNING}[!] Supabase: Error {res.status_code} at {sb_url}{Colors.ENDC}")
        except Exception:
            print(f"{Colors.FAIL}[✗] Supabase: Unreachable at {sb_url}{Colors.ENDC}")

def show_config(mask=True):
    print(f"\n{Colors.HEADER}=== Backend Configuration ==={Colors.ENDC}")
    config_vars = [
        "SUPABASE_URL", "SUPABASE_KEY", "DATABASE_URL", 
        "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "FRONTEND_URL",
        "JIRA_URL", "JIRA_PROJECT_KEY"
    ]
    for var in config_vars:
        val = os.getenv(var)
        if val:
            if mask and ("KEY" in var or "PASSWORD" in var or "TOKEN" in var or "URL" in var and "@" in var):
                 masked_val = val[:10] + "..." + val[-5:] if len(val) > 15 else "***"
                 print(f"{Colors.OKCYAN}{var:20}:{Colors.ENDC} {masked_val}")
            else:
                 print(f"{Colors.OKCYAN}{var:20}:{Colors.ENDC} {val}")
        else:
            print(f"{Colors.WARNING}{var:20}: [NOT SET]{Colors.ENDC}")

def set_config(key, value):
    if not dotenv_path:
        print(f"{Colors.FAIL}Error: .env file not found.{Colors.ENDC}")
        return
    set_key(dotenv_path, key.upper(), value)
    print(f"{Colors.OKGREEN}Successfully updated {key} in .env{Colors.ENDC}")

def manage_process():
    print(f"\n{Colors.HEADER}=== Backend Process Management ==={Colors.ENDC}")
    found = False
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_percent', 'cpu_percent']):
        try:
            cmdline = proc.info.get('cmdline') or []
            if any('uvicorn' in arg for arg in cmdline) and any('main:app' in arg for arg in cmdline):
                print(f"{Colors.OKGREEN}[RUNNING]{Colors.ENDC} PID: {proc.info['pid']}")
                print(f"   Name      : {proc.info['name']}")
                print(f"   CPU Usage : {proc.info['cpu_percent']}%")
                print(f"   Mem Usage : {proc.info['memory_percent']:.2f}%")
                found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    if not found:
        print(f"{Colors.FAIL}[STOPPED] No uvicorn backend process found.{Colors.ENDC}")

def main():
    parser = argparse.ArgumentParser(description="Pluto Backend Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Status Command
    subparsers.add_parser('status', help='Check connectivity and process status')

    # Config Command
    config_parser = subparsers.add_parser('config', help='Manage configurations')
    config_parser.add_argument('action', choices=['show', 'set'], help='Action to perform')
    config_parser.add_argument('key', nargs='?', help='Config key (for set)')
    config_parser.add_argument('value', nargs='?', help='Config value (for set)')
    config_parser.add_argument('--unmask', action='store_true', help='Show sensitive values')

    # Process Command
    subparsers.add_parser('process', help='View backend process details')

    # Logs Command
    logs_parser = subparsers.add_parser('logs', help='View backend logs from Supabase')
    logs_parser.add_argument('--limit', type=int, default=10, help='Number of log entries to show')

    # Metrics Command
    metrics_parser = subparsers.add_parser('metrics', help='View API performance metrics')
    metrics_parser.add_argument('--limit', type=int, default=10, help='Number of entries to show')

    args = parser.parse_args()

    if args.command == 'status':
        check_connectivity()
        manage_process()
    elif args.command == 'config':
        if args.action == 'show':
            show_config(mask=not args.unmask)
        elif args.action == 'set':
            if args.key and args.value:
                set_config(args.key, args.value)
            else:
                print(f"{Colors.FAIL}Error: key and value are required for set action.{Colors.ENDC}")
    elif args.command == 'process':
        manage_process()
    elif args.command == 'logs':
        fetch_logs(args.limit)
    elif args.command == 'metrics':
        fetch_metrics(args.limit)
    else:
        parser.print_help()

def fetch_metrics(limit):
    print(f"\n{Colors.HEADER}=== Recent API Performance Metrics ==={Colors.ENDC}")
    sb = get_supabase_client()
    if not sb: return
    try:
        res = sb.table("api_metrics").select("*").order("created_at", desc=True).limit(limit).execute()
        if res.data:
            print(f"{Colors.BOLD}{'Method':<8} {'Endpoint':<25} {'Status':<8} {'Latency':<10}{Colors.ENDC}")
            for m in res.data:
                latency = f"{m.get('latency_ms')}ms"
                status = str(m.get('status_code'))
                color = Colors.OKGREEN if status.startswith('2') else Colors.FAIL
                print(f"{m.get('method'):<8} {m.get('endpoint')[:25]:<25} {color}{status:<8}{Colors.ENDC} {latency:<10}")
        else:
            print("No metrics found.")
    except Exception as e:
        print(f"{Colors.FAIL}Error: {e}{Colors.ENDC}")

def fetch_logs(limit):
    print(f"\n{Colors.HEADER}=== Recent System Logs (from Supabase) ==={Colors.ENDC}")
    sb = get_supabase_client()
    if not sb:
        print(f"{Colors.FAIL}Error: Could not initialize Supabase client.{Colors.ENDC}")
        return
    try:
        res = sb.table("system_logs").select("*").order("created_at", desc=True).limit(limit).execute()
        if res.data:
            for log in res.data:
                color = Colors.OKGREEN if log.get('level') == 'info' else Colors.FAIL
                print(f"{Colors.OKCYAN}[{log.get('created_at')[:19]}]{Colors.ENDC} {color}[{log.get('level').upper()}]{Colors.ENDC} {log.get('message')}")
                if log.get('endpoint'):
                    print(f"   Endpoint: {log.get('endpoint')}")
        else:
            print("No logs found.")
    except Exception as e:
        print(f"{Colors.FAIL}Error fetching logs: {e}{Colors.ENDC}")

if __name__ == "__main__":
    main()
