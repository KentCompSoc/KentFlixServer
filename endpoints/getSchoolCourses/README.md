# Get Courses for a School

    GET /v1/:sessionID/schools/:schoolID/courses

## Description
Get all the courses that is within the given school that are currently accessable on the system, returned as a map for easier access.

## Example
**Request**

    GET /v1/<SESSION_ID>/schools/SoC/courses

**Results**

***Successful fetch of courses***
``` json
{
    success: true,
    payload: {
        "G400": {
            "name": "Computer Science with Year in Industry",
            "courseID": "G400",
        },
        ...
    },
    status: 200,
}
```

***School isnt on our System***
``` json
{
    success: false,
    error: {
      message: "We do not have this school on our records",
    },
    status: 500,
}
```

***Failed to get Courses***
``` json
{
    success: false,
    error: {
      message: "Failed to get courses",
    },
    status: 500,
}
```