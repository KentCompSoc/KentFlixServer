# Get Schools

    GET /v1/:sessionID/schools

## Description
Get all the schools that are currently accessable on the system, returned as a map for easier access.

## Example
**Request**

    GET /v1/<SESSION_ID>/schools

**Results**

***Successful fetch of schools***
``` json
{
    "success": true,
    "payload": {
        "SoC": {
            "name": "School of Computing",
            "schoolID": "SoC",
        },
        ...
    },
    "status": 200,
}
```

***Failed to get schools***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to get schools",
    },
    "status": 500,
}
```