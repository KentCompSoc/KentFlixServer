# Login as User

    POST /login

## Description
An existing user for the platform will be able to return to access the system using their email and password. So they will be able to use and access the lecture recordings. Before they must verify using the email verify.

***

## Parameters
- **body.email** _(required)_ — Email for user @kent.ac.uk
- **body.password** _(required)_ — No restriction on length yet

***

## Return format
A JSON object with key "status" and value of 200, a key "message" with value of "Successfully logged in.", and a key of "user" (userID) including the user model of the comment that was created.

***

## Errors
All known errors cause the resource to return HTTP error code header together with a JSON array containing at least 'status' and 'error' keys describing the source of error.

- **400 Bad Request** — The body of the user was not specified or in bad format.
- **404 Not Found** — The specified user was not found.

***

## Example
**Request**

    POST v1/login

**Body**
``` json
{
  "email" : "abc123@kent.ac.uk",
  "password" : "examplar_password",
}
```
**Result**
``` json
{
  "status" : 200,
  "message" : "Successfully added a comment.",
  "error" : "None"
  "comment": {
    "id": 83858343,
    "user_id": 198867,
    "to_whom_user_id": 347823,
    "body": "Nice color and composition.",
    "created_at": "2013-02-25T17:35:26-05:00",
    "parent_id": 73249443,
    "flagged": false,
    "rating": 0,
    "voted": false,
    "user": {
      "id": 198867,
      "username": "tye",
      "firstname": "Tye",
      "lastname": "Shavik",
      "city": "Toronto",
      "country": "Canada",
      "fullname": "Tye Shavik",
      "userpic_url": "http://acdn.500px.net/198867/7f5f29fd33e093062a30e2bf3a9e605c446ba960/1.jpg?29",
      "upgrade_status": 2,
      "followers_count": 36,
      "affection": 103,
      "admin": 1
    }
  }
}
```

[OAuth]: https://github.com/500px/api-documentation/tree/master/authentication