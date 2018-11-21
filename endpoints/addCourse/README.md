# Add a Course

    POST /:sessionID/courses/add

## Description
Add a school that isnt already on the platform giving its course code hand as its ID and name.

## NOTICE
Will become redundent when api version v1.1 is released

***

## Parameters
- **body.code** _(required)_ — Code for the course as found on module eg: "G404"
- **body.name** _(required)_ — Name of the school eg: "Computer Science with Year in Industry"
- **body.schoolID** _(required)_ — Name of the school that the course belongs to eg: "SoC"

***

## Example
**Request**

    POST v1/<SESSION_ID>/courses/add

**Results**

***Successful Addition of Course***
``` json
{
    "success": true,
    "payload": {
        "message": "Course has been created",
    },
    "status": 200,
}
```

***Failed to Create Course***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to create a course",
    },
    "status": 500,
}
```