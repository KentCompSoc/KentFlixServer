# Verify an Account

    GET /verify/:email/:token

## Description
Once a user has signed up they will be able verify their account to use and access the platform. They must open the email that has been sent to them and go to this link containing their email and token, and loading this will authorise the account.

## Example
**Request**

    GET v1/verify/abc@kent.ac.uk/ABCDEDFGHIJKLMOP

**Results**

***Successful Verification***
``` json
{
    success: true,
    payload: {
        message: "User has been verified, you can now log into the app",
    },
    status: 200,
}
```

***Already been verified***
``` json
{
    success: false,
    error: {
      message: "You have already been verified",
    },
    status: 211,
}
```

***Token given wasnt the correct one***
``` json
{
    success: false,
    error: {
      message: "Incorrect Token",
    },
    status: 205,
}
```

***A user already has that email***
``` json
{
    success: false,
    error: {
      message: "This email has already been used",
    },
    status: 211,
}
```

***Failed to verify the account***
``` json
{
    success: false,
    error: {
      message: "Failed to verify this user",
    },
    status: 500,
}
```

***No user with that email***
``` json
{
    success: false,
    error: {
      message: "Failed to find a new user by that email",
    },
    status: 500,
}
```