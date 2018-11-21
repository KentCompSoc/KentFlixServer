# Get Course

    GET /v1/:sessionID/courses/:courseID

## Description
Get details about the course itself that we have within the system.

## Example
**Request**

    GET /v1/<SESSION_ID>/courses/G404

**Results**

***Successful Fetch of Course Details***
``` json
{
    "success": true,
    "payload": {
        "id":"G400",
        "name":"Computer Science",
        "schoolID": "SoC",
    },
    "status": 200,
}
```

***Course is not on our System***
``` json
{
    "success": false,
    "error": {
      "message": "We do not have this course on our records",
    },
    "status": 500,
}
```

***Failed to Get Course***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to get course",
    },
    "status": 500,
}
```