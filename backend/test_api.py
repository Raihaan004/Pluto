import requests
import sys

def test_endpoints():
    base_url = "http://localhost:8000"
    
    print("Testing GET /notifications/test_user...")
    try:
        response = requests.get(f"{base_url}/notifications/test_user")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_endpoints()
