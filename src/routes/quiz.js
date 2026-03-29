const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('home', {
    pageTitle: res.locals.t.quiz,
    currentPath: '/quiz',
    houses: [],
    totalHouses: 0,
    avgScore: 0,
    completedCount: 0,
    groups: []
  });
});

module.exports = router;
