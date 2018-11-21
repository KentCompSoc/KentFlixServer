# Signup as User

    POST /signup

## Description
An user can sign up to use the platform and once verified will be able to return to access the system. They must verify the account by email before using the account.

***

## Parameters
- **body.email** _(required)_ — Email for user and must be a @kent.ac.uk email
- **body.password** _(required)_ — No restriction on password

***

## Example
**Request**

    POST v1/signup

**Body**
``` json
{
  email: "abc123@kent.ac.uk",
  password : "examplar_password",
}
```
**Results**

***Successful Login***
``` json
{
    success: true,
    payload: {
        message: "Now verify you account by checking your emails",
    },
    status: 200,
}
```

***Invalid Email***
``` json
{
    success: false,
    error: {
      message: "Please use a valid email",
    },
    status: 205,
}
```

***Invalid Password***
``` json
{
    success: false,
    error: {
      message: "Please use a valid password",
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

***Failed to signup the user***
``` json
{
    success: false,
    error: {
      message: "Failed to signup",
    },
    status: 500,
}
```