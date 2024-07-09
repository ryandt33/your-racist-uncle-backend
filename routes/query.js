const dokdo = require("../services/dokdo");
const strategy = require("../services/politicalStrategy");
const { main } = require("../services/tidyUncle");
const uncle = require("../services/uncleChain");
const tidyDokdo = require("../services/tidyDokdo");

const router = require("express").Router();

router.get("/", (req, res) => {
  res.send("Hello World");
});

router.post("/", async (req, res) => {
  const { statement, opinion } = req.body;
  const validOpinions = [
    "strongly agree",
    "agree",
    "disagree",
    "strongly disagree",
  ];

  if (!statement || !opinion) {
    return res.status(400).json({
      message: "Please provide a statement and an opinion",
    });
  } else if (!validOpinions.includes(opinion.toLowerCase())) {
    return res.status(400).json({
      message: "Please provide a valid opinion",
    });
  }

  const gptResponse = await uncle({ statement, opinion });

  res.json({
    statement,
    opinion,
    gptResponse,
  });
});

router.post("/all", async (req, res) => {
  await main();

  res.send("all done");
});

router.post("/political", async (req, res) => {
  await strategy();
});

router.post("/dokdo", async (req, res) => {
  await tidyDokdo.main();
});

module.exports = router;
