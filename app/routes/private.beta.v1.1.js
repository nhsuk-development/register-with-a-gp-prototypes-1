var express = require('express')
var router = express.Router()
var nunjucks = require('nunjucks')

var request = require('request')
var naturalSort = require('javascript-natural-sort')
var postcode_api = process.env.POSTCODE_API

/*
var helper = require('sendgrid').mail;
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var from_email = new helper.Email('rgp-team@digital.nhs.uk');
var to_email = new helper.Email('rgp-team@digital.nhs.uk');
*/

// Private beta v1.1 prototype
// Splits transaction into 2 distinct sections

// Start page +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/start', function (req, res) {
  req.session.edit = false;
  res.render('private_beta_v1_1/start', {
    suppressServiceName: true
  });
});

// Name ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/name', function (req, res) {
  if (!req.session.name) {
    res.render('private_beta_v1_1/name');
  } else {
    res.render('private_beta_v1_1/name', {
      first: req.session.name.firstName,
      middle: req.session.name.middleNames,
      last: req.session.name.lastName
    })
  }
});

router.post('/name', function (req, res) {

  var passed = true;

  if (!req.session.name) {
    req.session.name = {};
  }

  if (req.body['first-name'] === '' || req.body['last-name'] === '') {
    var error = 'Please enter your full name';
    passed = false;
  } else {
    req.session.name.firstName = req.body['first-name']
    req.session.name.middleNames = req.body['middle-names']
    req.session.name.lastName = req.body['last-name']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/name', {
      error,
      first: req.body['first-name'],
      middle: req.body['middle-names'],
      last: req.body['last-name']
    });
  } else {
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('date-of-birth')
    }
  }

})

// DOB +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/date-of-birth', function (req, res) {
  res.render('private_beta_v1_1/date-of-birth');
});

router.post('/date-of-birth', function (req, res) {

  req.session.dob = {
    'day': req.body['dob-day'],
    'month': req.body['dob-month'],
    'year': req.body['dob-year']
  };

  if (req.body['dob-day'] === '' || req.body['dob-month'] === '' || req.body['dob-year'] === '') {
    res.render('private_beta_v1_1/date-of-birth', { error: 'Please enter your date of birth' });
  } else {
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('home-address')
    }
  }
})

// Postcode ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/home-address', function (req, res) {
  res.render('private_beta_v1_1/home-address-postcode');
});

router.post('/home-address', function (req, res) {

  if (!req.session.homeAddress) {
    req.session.homeAddress = {}
  }

  req.session.homeAddress.postcode = req.body['postcode'];
  req.session.homeAddress.building = req.body['building'];

  if (req.body['postcode'] === '') {
    res.render('private_beta_v1_1/home-address-postcode', {
      error: {
        postcode: 'Please enter your home postcode'
      }
    });
  } else {
    // strip spaces
    var cleaned = req.session.homeAddress.postcode.replace(/\s+/g, '').toLowerCase();

    request('https://api.getAddress.io/v2/uk/' + cleaned + '/?api-key=' + postcode_api + '&format=true', function (error, response, body) {
      if (!error) {
        if (response.statusCode == 200) {
          var parsed = JSON.parse(body);
          var addresses = parsed['Addresses'];
          addresses.sort(naturalSort);
          var filtered = [];

          if (req.session.homeAddress.building !== '') {
            for (var i=0; i<addresses.length; i++) {
              //var current = addresses[i][0];
              var current = addresses[i].toString().toLowerCase();
              if (current.indexOf(req.session.homeAddress.building.toLowerCase()) !== -1) {
                filtered.push(addresses[i]);
              }
            }

            if (filtered.length === 0) {
              // Nothing found for this combo of building / postcode
              // So just display the postcode results?
              req.session.addressResults = addresses;
              res.render('private_beta_v1_1/home-address-result', {
                message: 'No exact match has been found, showing all addresses for ' + req.session.homeAddress.postcode,
              });
            } else {
              req.session.addressResults = filtered;
              res.render('private_beta_v1_1/home-address-result');
            }

          } else {

            req.session.addressResults = addresses;

            res.render('private_beta_v1_1/home-address-result');

          }
        }

      } else {
        res.render('private_beta_v1_1/home-address-postcode', {
          error: {
            general: 'Sorry, there’s been a problem looking up your address. Please try again.'
          }
        });
      }
    });
  }
})

// Address selection +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/select-address', function (req, res) {
  res.render('private_beta_v1_1/select-address');
});

router.post('/select-address', function (req, res) {

  if (!req.body['address']) {
    res.render('private_beta_v1_1/home-address-result', {
      error: 'Please select your home address'
    });
  } else {
    req.session.homeAddress.address = req.body['address'].split(',');
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('contact-email')
    }
  }
})

// Manual address entry ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/home-address-manual', function (req, res) {
  res.render('private_beta_v1_1/home-address-manual');
});

router.post('/home-address-manual', function (req, res) {

  if (!req.session.homeAddress) {
    req.session.homeAddress = {}
  }

  req.session.homeAddress.address = [
    req.body['address-1'],
    req.body['address-2'],
    req.body['address-3'],
    req.body['address-4']
  ];
  req.session.homeAddress.postcode = req.body['postcode'];

  if (!req.body['address-1'] && !req.body['address-4']) {
    res.render('private_beta_v1_1/home-address-manual', {
      error: 'Please enter your full address'
    });
  } else if (req.session.edit !== false) {
    res.redirect('check-your-answers')
  } else {
    res.redirect('contact-email')
  }

})

// Contact email +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/contact-email', function (req, res) {
  res.render('private_beta_v1_1/contact-email');
});

router.post('/contact-email', function (req, res) {

  if (!req.session.contact) {
    req.session.contact = {}
  }

  req.session.contact.email = req.body['email']

  if (req.session.edit !== false) {
    res.redirect('check-your-answers')
  } else {
    res.redirect('contact-telephone')
  }
})

// Contact phone +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/contact-telephone', function (req, res) {
  res.render('private_beta_v1_1/contact-telephone');
});

router.post('/contact-telephone', function (req, res) {

  if (!req.session.contact) {
    req.session.contact = {}
  }

  req.session.contact.telephone = req.body['telephone']

  if (req.session.edit !== false) {
    res.redirect('check-your-answers')
  } else {
    res.redirect('armed-forces')
  }
})

// Armed forces? +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/armed-forces', function (req, res) {
  res.render('private_beta_v1_1/armed-forces');
});

router.post('/armed-forces', function (req, res) {

  var passed = true;

  if (!req.session.armedforces) {
    req.session.armedforces = {}
  }

  if (!req.body['armed-forces']) {
    passed = false;
    error = 'Please answer ‘yes’ or ‘no’';
  } else {
    req.session.armedforces.leaving = req.body['armed-forces']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/armed-forces', { error });
  } else {

    if (req.session.edit !== false) {
      if (!req.session.armedforces.serviceno) {
        res.redirect('armed-forces-service-number')
      } else {
        res.redirect('check-your-answers')
      }
    } else {
      if (req.session.armedforces.leaving === 'yes') {
        res.redirect('armed-forces-service-number')
      } else {
        res.redirect('current-gp')
      }
    }

  }

});

// Armed forces service number +++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/armed-forces-service-number', function (req, res) {
  res.render('private_beta_v1_1/armed-forces-service-number');
});

router.post('/armed-forces-service-number', function (req, res) {

  if (!req.session.armedforces) {
    req.session.armedforces = {}
  }
  req.session.armedforces.serviceno = req.body['service-no']

  if (req.session.edit !== false) {
    if (!req.session.armedforces.enlistment) {
      res.redirect('armed-forces-enlistment-date')
    } else {
      res.redirect('check-your-answers')
    }
  } else {
    res.redirect('armed-forces-enlistment-date')
  }

});

// Armed forces enlistment date ++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/armed-forces-enlistment-date', function (req, res) {
  res.render('private_beta_v1_1/armed-forces-enlistment-date');
});

router.post('/armed-forces-enlistment-date', function (req, res) {

  if (!req.session.armedforces) {
    req.session.armedforces = {}
  }
  req.session.armedforces.enlistment = {
    day: req.body['enlistment-day'],
    month: req.body['enlistment-month'],
    year: req.body['enlistment-year']
  }

  if (req.session.edit !== false) {
    res.redirect('check-your-answers')
  } else {
    res.redirect('current-gp')
  }

});

// Current GP ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/current-gp', function (req, res) {
  res.render('private_beta_v1_1/current-gp');
})

router.post('/current-gp', function (req, res) {

  var passed = true;

  if (!req.session.currentgp) {
    req.session.currentgp = {}
  }

  if (!req.body['current-gp']) {
    passed = false;
    error = 'Please answer ‘yes’ or ‘no’';
  } else {
    req.session.currentgp.registered = req.body['current-gp']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/current-gp', { error });
  } else if (req.body['current-gp'] === 'yes') {
    res.redirect('current-gp-lookup')
  } else {
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('nhs-number')
    }
  }

});

// Lookup GP +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/current-gp-lookup', function (req, res) {
  res.render('private_beta_v1_1/gp-lookup');
});

router.post('/current-gp-lookup', function (req, res) {

  if (!req.session.currentgp) {
    req.session.currentgp = {}
  }

  req.session.currentgp.name = req.body['practice-name'];
  req.session.currentgp.address = req.body['practice-address'].split(',');
  if (req.session.edit !== false) {
    if (!req.session.prevaddress) {
      res.redirect('registered-address')
    } else {
      res.redirect('check-your-answers')
    }
  } else {
    res.redirect('registered-address')
  }
});

// Registered address ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/registered-address', function (req, res) {
  res.render('private_beta_v1_1/registered-address');
})

router.post('/registered-address', function (req, res) {

  if (!req.session.currentgp.registeredaddress) {
    req.session.currentgp.registeredaddress = {}
  }

  var passed = true;

  if (!req.body['registered-address-correct']) {
    passed = false;
    var error = 'Please answer ‘yes’ or ‘no’';
  } else {
    req.session.currentgp.registeredaddress.correct = req.body['registered-address-correct'];
  }

  if (passed === false) {
    res.render('private_beta_v1_1/registered-address', { error });
  } else if (req.body['registered-address-correct'] === 'no') {
    res.redirect('registered-address-postcode')
  } else {
    if (req.session.edit === 'part-one' && req.session.name.nameChanged) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('registered-name')
    }
  }

});

// Registered address - find +++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/registered-address-postcode', function (req, res) {
  res.render('private_beta_v1_1/registered-address-postcode');
});

router.post('/registered-address-postcode', function (req, res) {

  req.session.currentgp.registeredaddress.postcode = req.body['postcode'];
  req.session.currentgp.registeredaddress.building = req.body['building'];

  if (req.body['postcode'] === '') {
    res.render('private_beta_v1_1/registered-address-postcode', {
      error: {
        postcode: 'Please enter your previous postcode'
      }
    });
  } else {
    // strip spaces
    var cleaned = req.session.currentgp.registeredaddress.postcode.replace(/\s+/g, '').toLowerCase();

    request('https://api.getAddress.io/v2/uk/' + cleaned + '/?api-key=' + postcode_api + '&format=true', function (error, response, body) {
      if (!error) {
        if (response.statusCode == 200) {
          var parsed = JSON.parse(body);
          var addresses = parsed['Addresses'];
          addresses.sort(naturalSort);
          var filtered = [];

          if (req.session.currentgp.registeredaddress.building !== '') {
            for (var i=0; i<addresses.length; i++) {
              //var current = addresses[i][0];
              var current = addresses[i].toString().toLowerCase();
              if (current.indexOf(req.session.currentgp.registeredaddress.building.toLowerCase()) !== -1) {
                filtered.push(addresses[i]);
              }
            }

            if (filtered.length === 0) {
              // Nothing found for this combo of building / postcode
              // So just display the postcode results?
              req.session.currentgp.registeredaddressresults = addresses;
              res.render('private_beta_v1_1/registered-address-result', {
                message: 'No exact match has been found, showing all addresses for ' + req.session.currentgp.registeredaddress.postcode,
                session: req.session
              });
            } else {
              req.session.currentgp.registeredaddressresults = filtered;
              res.render('private_beta_v1_1/registered-address-result');
            }

          } else {

            req.session.currentgp.registeredaddressresults = addresses;

            res.render('private_beta_v1_1/registered-address-result');

          }
        }

      } else {
        res.render('private_beta_v1_1/registered-address-postcode', {
          error: {
            general: 'Sorry, there’s been a problem looking up your address. Please try again.'
          }
        });
      }
    });
  }
})

// Registered address selection ++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/select-registered-address', function (req, res) {
  res.render('private_beta_v1_1/select-registered-address');
});

router.post('/select-registered-address', function (req, res) {

  if (!req.body['address']) {
    res.render('private_beta_v1_1/registered-address-result', {
      error: 'Please select your previous address'
    });
  } else {
    req.session.currentgp.registeredaddress.address = req.body['address'].split(',');
    //if (req.session.edit === 'part-one' && req.session.name.nameChanged) {
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('registered-name')
    }
  }
})

// Manual address entry ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/registered-address-manual', function (req, res) {
  res.render('private_beta_v1_1/registered-address-manual');
});

router.post('/registered-address-manual', function (req, res) {

  req.session.currentgp.registeredaddress.address = [
    req.body['address-1'],
    req.body['address-2'],
    req.body['address-3'],
    req.body['address-4']
  ];
  req.session.currentgp.registeredaddress.postcode = req.body['postcode'];

  if (!req.body['address-1'] && !req.body['address-4']) {
    res.render('private_beta_v1_1/registered-address-manual', {
      error: 'Please enter your full address'
    });
  //} else if (req.session.edit === 'part-one' && req.session.name.nameChanged) {
  } else if (req.session.edit !== false) {
    res.redirect('check-your-answers')
  } else {
    res.redirect('registered-name')
  }

})


// Registered name +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

router.get('/registered-name', function(req, res) {
  res.render('private_beta_v1_1/registered-name');
});

router.post('/registered-name', function(req, res) {

  var passed = true;

  if (!req.session.currentgp.registeredname) {
    req.session.currentgp.registeredname = {};
  }

  if (!req.body['name-different']) {
    error = 'Please answer this question';
    passed = false;
  } else {
    req.session.currentgp.registeredname.different = req.body['name-different'];
  }

  if (passed === false) {
    res.render('private_beta_v1_1/registered-name', { error });
  } else {
    if (req.body['name-different'] === 'yes') {
      res.redirect('registered-name-details')
    } else {
      if (req.session.edit !== false) {
        res.redirect('check-your-answers')
      } else {
        res.redirect('nhs-number')
      }
    }
  }
});

// Registered name details +++++++++++++++++++++++++++++++++++++++++++++++++++++++

router.get('/registered-name-details', function(req, res) {
  res.render('private_beta_v1_1/registered-name-details');
});

router.post('/registered-name-details', function(req, res) {

  var passed = true;

  if (!req.session.currentgp.registeredname) {
    req.session.currentgp.registeredname = {};
  }

  if (!req.body['registered-first-name'] && !req.body['registered-last-name']) {
    error = 'Please enter your full registered name';
    passed = false;
  } else {
    req.session.currentgp.registeredname.firstName = req.body['registered-first-name'];
    req.session.currentgp.registeredname.middleNames = req.body['registered-middle-names'];
    req.session.currentgp.registeredname.lastName = req.body['registered-last-name'];
  }

  if (passed === false) {
    res.render('private_beta_v1_1/registered-name-details', { error });
  } else {
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('nhs-number')
    }
  }

});

// NHS Number ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/nhs-number', function (req, res) {
  res.render('private_beta_v1_1/nhs-number');
})

router.post('/nhs-number', function (req, res) {

  var passed = true;

  if (!req.session.nhsnumber) {
    req.session.nhsnumber = {};
  }

  if (!req.body['nhs-number-known']) {
    error = 'Please answer ‘yes’ or ‘no’';
    passed = false;
  } else {
    req.session.nhsnumber.known = req.body['nhs-number-known'];
  }

  if (passed === false) {
    res.render('private_beta_v1_1/nhs-number', { error });
  } else {
    if (req.body['nhs-number-known'] === 'yes') {
      res.redirect('nhs-number-details')
    } else {
      if (req.session.edit !== false) {
        res.redirect('check-your-answers')
      } else {
        res.redirect('part-two')
      }
    }
  }

})

// NHS Number details ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/nhs-number-details', function (req, res) {
  res.render('private_beta_v1_1/nhs-number-details' );
})

router.post('/nhs-number-details', function (req, res) {

  var passed = true;

  if (!req.session.nhsnumber) {
    req.session.nhsnumber = {};
  }

  if (req.body['nhs-number'] === '') {
    passed = false;
    error = 'Please enter your NHS number';
  } else {
    req.session.nhsnumber.number = req.body['nhs-number'];
  }

  if (passed === false) {
    res.render('private_beta_v1_1/nhs-number-details', { error });
  } else {
    if (req.session.edit !== false) {
      res.redirect('check-your-answers')
    } else {
      res.redirect('part-two')
    }
  }

});

// End of 'your details' - sum up for editing
/*router.get('/check-your-details', function (req, res) {
  if (req.session.edit !== 'part-two') {
    req.session.edit = 'part-one';
  }
  res.render('private_beta_v1_1/check-your-details' );
})*/

// Part two start ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/part-two', function (req, res) {
  res.render('private_beta_v1_1/part-two-start');
});


// Minimumn health questionnaire: current meds? ++++++++++++++++++++++++++++++++
router.get('/current-medication', function (req, res) {
  res.render('private_beta_v1_1/current-medication');
});

router.post('/current-medication', function (req, res) {

  var passed = true;

  if (!req.session.health) {
    req.session.health = {}
  }

  if (!req.body['medication']) {
    passed = false;
    var error = 'Please answer ‘yes’ or ‘no’';
  } else {
    req.session.health.medication = req.body['medication']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/current-medication', { error });
  } else if (req.body['medication'] === 'yes') {
    res.redirect('current-medication-details')
  } else {
    if (req.session.edit === 'part-two') {
      res.redirect('check-your-answers')
    } else {
      res.redirect('any-allergies')
    }
  }

});

// Minimumn health questionnaire: current med details ++++++++++++++++++++++++++
router.get('/current-medication-details', function (req, res) {
  res.render('private_beta_v1_1/current-medication-details');
});

router.post('/current-medication-details', function (req, res) {

  var passed = true;

  if (!req.session.health) {
    req.session.health = {}
  }

  if (req.body['medication-details'] === '') {
    passed = false;
    var error = 'Please enter your medication details';
  } else {
    req.session.health.medicationDetails = req.body['medication-details']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/current-medication-details', { error });
  } else {
    if (req.session.edit === 'part-two') {
      res.redirect('check-your-answers')
    } else {
      res.redirect('any-allergies')
    }
  }
});

// Minimumn health questionnaire: allergies ++++++++++++++++++++++++++++++++++++
router.get('/any-allergies', function (req, res) {
  res.render('private_beta_v1_1/any-allergies');
});

router.post('/any-allergies', function (req, res) {

  var passed = true;

  if (!req.session.health) {
    req.session.health = {}
  }

  if (!req.body['allergies']) {
    passed = false;
    var error = 'Please answer ‘yes’ or ‘no’';
  } else {
    req.session.health.allergies = req.body['allergies']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/any-allergies', { error });
  } else if (req.body['allergies'] === 'yes') {
    res.redirect('allergies-details')
  } else {
    if (req.session.edit === 'part-two') {
      res.redirect('check-your-answers')
    } else {
      res.redirect('medical-history')
    }
  }

});

// Minimumn health questionnaire: allergies details ++++++++++++++++++++++++++++
router.get('/allergies-details', function (req, res) {
  res.render('private_beta_v1_1/allergies-details');
});

router.post('/allergies-details', function (req, res) {

  var passed = true;

  if (!req.session.health) {
    req.session.health = {}
  }

  if (req.body['allergies-details'] === '') {
    passed = false;
    var error = 'Please enter your allergy details';
  } else {
    req.session.health.allergiesDetails = req.body['allergies-details']
  }

  if (passed === false) {
    res.render('private_beta_v1_1/allergies-details', { error });
  } else {
    if (req.session.edit === 'part-two') {
      res.redirect('check-your-answers')
    } else {
      res.redirect('medical-history')
    }
  }
});

// Minimumn health questionnaire: medical histoy +++++++++++++++++++++++++++++++
router.get('/medical-history', function (req, res) {
  res.render('private_beta_v1_1/history');
});

router.post('/medical-history', function (req, res) {

  if (!req.session.health) {
    req.session.health = {}
  }

  var history = req.body['medical-history'];

  if (history === '') {
    history = 'no'
  }

  req.session.health.medicalHistory = history

  res.redirect('check-your-answers')

});

// End of 'questionnaire' - sum up for editing
router.get('/check-your-answers', function (req, res) {
  req.session.edit = 'part-two';
  res.render('private_beta_v1_1/check-your-answers' );
})

// Registration submitted ++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/registration-submitted', function (req, res) {
  req.session.edit = false;

  // Fire off the email to the GP
  /*
  var submission = nunjucks.render('../views/_includes/email-submission-table.html', { session: req.session })
  var subject = 'New registration request';
  var content = new helper.Content(
    'text/html',
    submission
  );
  var mail = new helper.Mail(from_email, subject, to_email, content);
  mail.setTemplateId('a3834fbd-3eb0-4a0b-a2c5-ee7fa9050847');

  var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
  var request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  sg.API(request, function(error, response) {
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
  });
  */

  res.render('private_beta_v1_1/registration-submitted');
});



// EMAIL to GP +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
router.get('/gp-email', function (req, res) {
  req.session.edit = false;
  res.render('private_beta_v1_1/_email-gp-notification');
});

module.exports = router
