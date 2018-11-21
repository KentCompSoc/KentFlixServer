# Assign module to a Coursse

    POST /:sessionID/modules/:moduleID/assignTo/:courseID

## Description
Assign a module to a chouse so extra schools can share modules.

## NOTICE
Might become redundent when api version v1.1 is released

## Example
**Request**

    POST v1/<SESSION_ID>/modules/CO510/assignTo/G404

**Results**

***Successful Assignment of Module***
``` json
{
    "success": true,
    "payload": {
        "message": "Module has been assigned to course,
    },
    "status": 200,
}
```

***Failed to Assign Module***
``` json
{
    "success": false,
    "error": {
      "message": "Failed to assign module to course",
    },
    "status": 500,
}
```