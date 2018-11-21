# Get Courses for a School

    GET /v1/:sessionID/courses/:courseID/modules

## Description
Get all the modules that is within the given course that are currently accessable on the system, returned as a map for easier access.

## Example
**Request**

    GET /v1/<SESSION_ID>/courses/G404/modules

**Results**

***Successful Fetch of Modules***
``` json
{
    "success": true,
    "payload": {
        "CO520": {
            "moduleID": "CO520",
            "name": "Further Object-Oriented Programming",
            "stage": 1,
            "term": "SPR",
        },
        ...
    },
    "status": 200,
}
```

***Course isnt on our System***
``` json
{
    "success": false,
    "error": {
      "message": "We do not has this course on our records",
    },
    "status": 500,
}
```

***Failed to Get Modules***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to get modules",
    },
    "status": 500,
}
```