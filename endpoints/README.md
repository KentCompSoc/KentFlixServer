## Endpoints

#### Auth

- **[<code>POST</code> /login](./login/README.md)**
- **[<code>POST</code> /signup](./signup/README.md)**
- **[<code>GET</code> /verify/:email/:token](./verify/README.md)**

#### User

- **[<code>GET</code> /:sessionID/me](./me/README.md)**

#### Schools

- **[<code>GET</code> /:sessionID/schools](./getSchools/README.md)**
- **[<code>POST</code> /:sessionID/schools/add](./addSchool/README.md)**

#### Courses

- **[<code>GET</code> /:sessionID/schools/:schoolID/courses](./getCoursesForSchool/README.md)**
- **[<code>GET</code> /:sessionID/courses/:courseID](./getCourse/README.md)**
- **[<code>POST</code> /:sessionID/courses/add](./addCourses/README.md)**

#### Modules

- **[<code>GET</code> /:sessionID/courses/:schoolID/modules](./getModulesForCourse/README.md)**
- **[<code>GET</code> /:sessionID/modules/:moduleID](./getModule/README.md)**
- **[<code>POST</code> /:sessionID/modules/add](./addModule/README.md)**

#### Lectures (Not currently documentated)

- **[<code>GET</code> /:sessionID/modules/:moduleID/lectures](#get-module-current-lectures)**
- **[<code>GET</code> /:sessionID/modules/:moduleID/lectures/:year](#get-module-lectures-by-year)**
- **[<code>GET</code> /:sessionID/lectures/:lectureID](#get-lecture)**


## Documentation yet to write

### Get Lectures

<code>GET</code> https://api.kentflix.com/v1/:sessionID/courses/:courseID/:year/lectures

PARAMETERS: courseID would be CO320, year would be 2017 or 2018

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Get Lecture

<code>GET</code> https://api.kentflix.com/v1/:sessionID/lectures/:lectureID

PARAMETERS: lectureID would be the lecture hash from [Get Lectures](#get-lectures)

RETURNS: {error: false, responce: LECTURE_INFOMATION}