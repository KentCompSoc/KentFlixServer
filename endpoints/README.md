## Endpoints

#### Auth

- **[<code>POST</code> /login](./login)**
- **[<code>POST</code> /signup](./signup)**
- **[<code>GET</code> /verify/:email/:token](./verify)**

#### User

- **[<code>GET</code> /:sessionID/me](./me)**

#### Schools

- **[<code>GET</code> /:sessionID/schools](./getSchools)**
- **[<code>POST</code> /:sessionID/schools/add](./addSchool)**

#### Courses

- **[<code>GET</code> /:sessionID/schools/:schoolID/courses](./getCoursesForSchool)**
- **[<code>GET</code> /:sessionID/courses/:courseID](./getCourse)**
- **[<code>POST</code> /:sessionID/courses/add](./addCourses)**

#### Modules

- **[<code>GET</code> /:sessionID/courses/:schoolID/modules](./getModulesForCourse)**
- **[<code>GET</code> /:sessionID/modules/:moduleID](./getModule)**
- **[<code>POST</code> /:sessionID/modules/add](./addModule)**

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