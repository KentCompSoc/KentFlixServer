# Add a School

    POST /:sessionID/schools/add

## Description
Add a school that isnt already on the platform giving its short hand as its ID and name.

## NOTICE
Will become redundent when api version v1.1 is released

***

## Parameters
- **body.shorthand** _(required)_ — Shorthand for the school eg: "SoC"
- **body.name** _(required)_ — Name of the school eg: "School of Computing"

***

## Example
**Request**

    POST v1/<SESSION_ID>/schools/add

**Results**

***Successful Addition of School***
``` json
{
    "success": true,
    "payload": {
        "message": "Created School",
    },
    "status": 200,
}
```

***Failed to create school***
``` json
{
    "success": false,
    error: {
      "message": "Failed to create a school",
    },
    "status": 500,
}
```