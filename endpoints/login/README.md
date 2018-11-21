# Login as User

    POST /login

## Description
An existing user for the platform will be able to return to access the system using their email and password. So they will be able to use and access the lecture recordings. Before they must verify using the email verify.

***

## Parameters
- **body.email** _(required)_ — Email for user and must be a @kent.ac.uk email
- **body.password** _(required)_ — No restriction on password, MUST not be kent account password

***

## Example
**Request**

    POST v1/login

**Body**
``` json
{
  "email": "abc123@kent.ac.uk",
  "password" : "<PASSWORD>",
}
```
**Results**

***Successful Login***
``` json
{
    "success": true,
    "payload": {
        "sessionID": "<SESSION_STRING>",
    },
    "status": 200,
}
```

***Invalid Email***
``` json
{
    "success": false,
    "error": {
      "message": "Please use a valid email",
    },
    "status": 205,
}
```

***Invalid Password***
``` json
{
    "success": false,
    "error": {
      "message": "Please use a valid password",
    },
    "status": 205,
}
```

***User entered a wrong password for account***
``` json
{
    "success": false,
    "error": {
      "message": "Invalid password",
    },
    "status": 205,
}
```

***No user with that email***
``` json
{
    "success": false,
    "error": {
      "message": "No user with that email",
    },
    "status": 206,
}
```

***User has not verified***
``` json
{
    "success": false,
    "error": {
      "message": "You have not verified, check your email",
    },
    "status": 221,
}
```

***Server failed to generate a session***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to create a session",
    },
    "status": 500,
}
```

***Failed to log use in***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to log user in",
    },
    "status": 500,
}
```