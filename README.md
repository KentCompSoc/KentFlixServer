# KentFlixServer
An open source elegant solution to watching Kent lecture recordings. This is the server architechure for the platform.

## Installation
Install dependencies:

	npm install
Then deploy the server locally:

	firebase deploy
    
## Useage

### Sign Up

POST: https://kentflix-7f510.firebaseapp.com/api/v1/signup

VALUES: email, password

### Login

POST: https://kentflix-7f510.firebaseapp.com/api/v1/login

VALUES: email, password

EXAMPLE RETURN:
{error: false, infoMessage: "User now signed in"}
{error: true, infoMessage: "Invalid Password"}

### Verify Account

https://kentflix-7f510.firebaseapp.com/api/v1/verify/:email/:token

NOTE: Will change to not be within the API itself