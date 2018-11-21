# Add a Module

    POST /:sessionID/modules/add

## Description
Add a school that isnt already on the platform giving its course code hand as its ID and name.

## NOTICE
Will become redundent when api version v1.1 is released

***

## Parameters
- **body.code** _(required)_ — Code for the module as found on module eg: "CO510"
- **body.name** _(required)_ — Name of the module eg: "Software Engineering"
- **body.courseID** _(required)_ — Name of the course that the course belongs to eg: "G404"
- **body.stage** _(required)_ — The stage the module is taught at, eg: 1 (Stage 1), 2 (Stage 2)
- **body.term** _(required)_ — The term which the module is taught in "AUT", "SPR", "SUM"

***

## Example
**Request**

    POST v1/<SESSION_ID>/modules/add

**Results**

***Successful Addition of Module***
``` json
{
    "success": true,
    "payload": {
        "message": "Module has been created",
    },
    "status": 200,
}
```

***Failed to Create Course***
``` json
{
    "success": false,
    error: {
      "message": "Failed to create a module",
    },
    "status": 500,
}
```