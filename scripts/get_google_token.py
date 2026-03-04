import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/calendar"]

base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

secrets_path = os.path.join(base_path, ".gitignore", "client_secrets.json")

flow = InstalledAppFlow.from_client_secrets_file(secrets_path, SCOPES)

creds = flow.run_local_server(port=8080)

print("ACCESS TOKEN:")
print(creds.token)

print("REFRESH TOKEN:")
print(creds.refresh_token)