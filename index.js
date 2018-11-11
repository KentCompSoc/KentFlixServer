const requestPromise = require('request-promise');
const xml2js = require('xml2js');

var options = {
  method: 'GET',
  uri: 'https://cors-anywhere.herokuapp.com/http://player.kent.ac.uk/Panopto/Podcast/Podcast.ashx?courseid=' + course.hash + '&type=mp4',
  headers: {
      'x-requested-with': 'https://player.kent.ac.uk',
  }
};

console.log("a");

requestPromise(options)
  .then(function (xml) {
  
      return xml2js.parseString(xml, function (err, json) {
        console.log(json);
        return console.log('Done');
      });
  })
  .catch(function (err) {
      return console.warn("Could not update CourseHash - " + course.hash + " "+ err);
  });