var express = require('express')
var request = require('request')
var router = express.Router()

var postcode_api = process.env.POSTCODE_API

router.get('/', function (req, res) {
  req.session.destroy(function(err) {
    console.log('Index page - destroying session');
  })
  res.render('index.html');
});

// Start page ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/start', function (req, res) {
  req.session.destroy(function(err) {
    console.log('Start page - destroying session');
  })
  res.render('v1/start');
});

// Name ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/name', function (req, res) {
  res.render('v1/name', {
    name: req.session.name
  });
});

router.post('/v1/name', function (req, res) {

  var passed = true;
  var errors = {};

  req.session.name = {
    'firstName': req.body['first-name'],
    'middleNames': req.body['middle-names'],
    'lastName': req.body['last-name'],
    'nameChanged': req.body['name-changed'],
    'firstNamePrev': req.body['first-name-previous'],
    'middleNamesPrev': req.body['middle-names-previous'],
    'lastNamePrev': req.body['last-name-previous']
  };

  if (req.body['first-name'] === '' || req.body['last-name'] === '') {
    errors['name'] = 'Please enter your full name';
    passed = false;
  }

  if (!req.body['name-changed']) {
    errors['name-changed'] = 'Please answer this question';
    passed = false;
  }

  if (req.body['name-changed'] === 'yes' && !req.body['first-name-previous'] && !req.body['last-name-previous']) {
    errors['previous-name'] = 'Please enter your previous name';
    passed = false;
  }

  if (passed === false) {
    res.render('v1/name', {
      errors,
      name: req.session.name
    });
  } else {
    res.redirect('/v1/date-of-birth')
  }

})

// DOB +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/date-of-birth', function (req, res) {
  res.render('v1/date-of-birth', {
    dob: req.session.dob
  });
});

router.post('/v1/date-of-birth', function (req, res) {

  req.session.dob = {
    'day': req.body['dob-day'],
    'month': req.body['dob-month'],
    'year': req.body['dob-year']
  };

  if (req.body['dob-day'] === '' || req.body['dob-month'] === '' || req.body['dob-year'] === '') {
    res.render('v1/date-of-birth', {
      error: 'Please enter your date of birth'
    });
  } else {
    res.redirect('/v1/home-address')
  }
})

// Postcode ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/home-address', function (req, res) {
  res.render('v1/home-address-postcode', {
    postcode: req.session.postcode
  });
});

router.post('/v1/home-address', function (req, res) {

  req.session.postcode = req.body['postcode'];

  if (req.body['postcode'] === '') {
    res.render('v1/home-address-postcode', {
      error: 'Please enter your home postcode'
    });
  } else {
    // strip spaces
    var cleaned = req.session.postcode.replace(/\s+/g, '').toLowerCase();

    // getaddress.io API function
    request('https://api.getAddress.io/v2/uk/' + cleaned + '?api-key=' + postcode_api + '&format=true', function (error, response, body) {
      if (!error && response.statusCode == 200) {

        var parsed = JSON.parse(body);
        req.session.addressResults = parsed['Addresses'];

        res.render('v1/home-address-result', {
          postcode: req.session.postcode,
          results: req.session.addressResults
        });
      } else {
        res.render('v1/home-address-postcode', {
          error: 'Sorry, there’s been a problem looking up your postcode. Please try again.',
          postcode: req.session.postcode
        });
      }
    });
  }
})

// Address selection +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/select-address', function (req, res) {
  res.render('v1/select-address', {
    postcode: req.session.postcode,
    results: req.session.addressResults
  });
});

router.post('/v1/select-address', function (req, res) {

  req.session.address = req.body['address'];

  if (!req.body['address']) {
    res.render('v1/home-address-result', {
      error: 'Please select your home address',
      postcode: req.session.postcode,
      results: req.session.addressResults
    });
  } else {
    res.redirect('/v1/contact-details')
  }
})

// Contact details +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/contact-details', function (req, res) {
  res.render('v1/contact-details', {
    contact: req.session.contact
  });
});

router.post('/v1/contact-details', function (req, res) {

  req.session.contact = {
    telephone: req.body['telephone'],
    mobile: req.body['mobile'],
    email: req.body['email']
  }

  if (req.body['telephone'] === '' && req.body['mobile'] === '' && req.body['email'] === '') {
    res.render('v1/contact-details', {
      error: 'Please enter at least one'
    });
  } else {
    res.redirect('/v1/nhs-number')
  }
})

// NHS Number known? +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/nhs-number', function (req, res) {
  res.render('v1/nhs-number-choice', {
    nhsnumber: req.session.nhsnumber
  });
})

router.post('/v1/nhs-number', function (req, res) {

  req.session.nhsnumber = {
    known: req.body['nhs-number-known'],
    number: ''
  }

  if (!req.body['nhs-number-known']) {
    res.render('v1/nhs-number-choice', {
      error: 'Please answer ‘yes’ or ‘no’'
    });
  }
  if (req.body['nhs-number-known'] === 'yes') {
    res.redirect('/v1/nhs-number-entry')
  } else if (req.body['nhs-number-known'] === 'no') {
    res.redirect('/v1/confirm-details')
  }
})

// NHS Number entry ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.post('/v1/nhs-number-entry', function (req, res) {

  req.session.nhsnumber.number = req.body['nhs-number'];

  if (req.body['nhs-number'] === '') {
    res.render('v1/nhs-number-entry', {
      error: 'Please enter your NHS number'
    });
  } else {
    res.redirect('/v1/confirm-details')
  }
})

// Check you answers +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/v1/confirm-details', function (req, res) {
  res.render('v1/confirm-details', {
    session: req.session
  });
});



module.exports = router
