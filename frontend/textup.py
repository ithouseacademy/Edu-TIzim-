import requests

url = "https://api-auth.textup.uz/v1/login"

payload = {
    "email": "webstorm150@gmail.com",
    "password": "60d731db"
}

response = requests.post(url, json=payload)

print(response.status_code)
print(response.text)