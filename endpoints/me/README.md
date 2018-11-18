# Get the Users profile

    POST /:sessionID/me

## Description
Able to recieve all the infomation based on the user to support a customised feel for each user

***

## Parameters
- None

***

## Example
**Request**

    POST v1/:sessionID/me

**Results**

***Successful Login***
``` json
{
    success: true,
    payload: {
      sessionID: "<SESSION_ID>"
    },
    status: 200,
}
```