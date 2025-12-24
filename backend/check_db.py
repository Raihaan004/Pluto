from database import supabase
import sys

def check_table(table_name):
    try:
        print(f"Checking '{table_name}' table...")
        response = supabase.table(table_name).select("*").execute()
        print(f"Table '{table_name}' exists.")
        print(f"Count: {len(response.data)}")
        if len(response.data) > 0:
            print(f"Sample data: {response.data[0]}")
        else:
            print("Table is empty.")
    except Exception as e:
        print(f"Error accessing '{table_name}' table:")
        print(e)

if __name__ == "__main__":
    check_table("users")
    print("-" * 20)
    check_table("notifications")
