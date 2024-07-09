const outputs = require("./dokdo.json");
const call = require("./openAI");
const fs = require("fs");
const { loop } = require("./tidyUncle");

const values = {
  "strongly agree": 95,
  agree: 75,
  disagree: 25,
  "strongly disagree": 0,
};

const likertQuery = async ({
  statement,
  promptChain = [],
  audienceOpinion,
}) => {
  const newPromptChain = [
    ...promptChain,
    {
      role: "user",
      content: `Return a likert answer of ONLY "strongly agree", "agree", "disagree", or "strongly disagree" to the following statement: ${statement} as JSON in the following format:
        {
            "aiOpinion": <your opinion - ENUM: "strongly agree", "agree", "disagree", "strongly disagree">
            "aiPercentOpinion": <return your opinion as a percentage - 0 = ABSOLUTELY DISAGREE, 100 = ABSOLUTELY AGREE>
        }
        `,
    },
  ];

  try {
    const likertRes = await call({
      userPrompt: newPromptChain,
      jsonOutput: true,
      temperature: 0.1,
    });

    const jsonRes = JSON.parse(likertRes);

    if (
      !jsonRes.aiOpinion ||
      !["strongly agree", "agree", "disagree", "strongly disagree"].includes(
        jsonRes.aiOpinion
      )
    ) {
      if (jsonRes.aiPercentOpinion) {
        const percent = parseInt(jsonRes.aiPercentOpinion);

        if (!isNaN(percent)) {
          if (percent === 50) {
            return {
              aiOpinion: audienceOpinion?.aiOpinion ?? audienceOpinion,
              aiPercentOpinion: percent,
            };
          } else {
            const value = Object.entries(values).reduce((acc, [key, val]) => {
              if (Math.abs(val - percent) < Math.abs(acc - percent)) {
                return val;
              }

              return acc;
            });
            const key = Object.keys(values).find((k) => values[k] === value);

            return {
              aiOpinion: key,
              aiPercentOpinion: value,
            };
          }
        }
      }

      throw "No opinion was returned from the AI";
    }

    return jsonRes;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const strategy = async () => {
  const politicalAttempts = fs.readFileSync(
    `${__dirname}/../docs/dokdo.json`,
    "utf8"
  );

  // const opinionList = outputs.map((o) => {
  //   const opinionList = [o.initialOpinion];

  //   const targetOpinion = o?.initialOpinion?.includes("disagree")
  //     ? "strongly agree"
  //     : "strongly disagree";

  //   if (o.promptChain) {
  //     opinionList.push(targetOpinion);
  //   }

  //   if (o.mildOpinionChain) {
  //     opinionList.push(targetOpinion);
  //   }

  //   if (o.agree) {
  //     opinionList.push("agree");
  //   }

  //   if (o.disagree) {
  //     opinionList.push("disagree");
  //   }

  //   return { ...o, opinionList };
  // });

  // fs.writeFileSync(
  //   `${__dirname}/../docs/dokdo.json`,
  //   JSON.stringify(opinionList, null, 2),
  //   "utf8"
  // );

  const opinionList = [];

  const politicalAttemptsJSON = JSON.parse(politicalAttempts);

  const initialOpinionGen = await Promise.all(
    outputs
      .filter((o) => !o.initialOpinion)
      .map(async (o) => {
        const likert = await likertQuery({
          statement: o,
        });

        console.log({ statement: o, likert });
      })
  );

  const fullConviction = await Promise.all(
    outputs
      .filter((o) => o.promptChain)
      .map(async (o) => {
        if (!o.initialOpinion) {
          const likert = await likertQuery({
            statement: o.statement,
          });

          o.initialOpinion = likert.aiOpinion;
        }
        o.targetOpinion = o.initialOpinion.includes("disagree")
          ? "strongly agree"
          : "strongly disagree";

        const conviction = `I ${o.targetOpinion} that ${o.statement}`;

        return {
          ...o,
          conviction,
        };
      })
  );

  console.log(fullConviction);

  const unflippedPrompts = outputs.filter((o) => {
    const keys = Object.keys(o);

    const initialOpinion = o.initialOpinion;

    const alignedKeys = !initialOpinion
      ? []
      : initialOpinion?.includes("disagree")
      ? ["strongly disagree", "disagree"]
      : ["strongly agree", "agree"];
    const baseKeys = ["statement", "initialOpinion", ...alignedKeys];
    const filteredKeys = keys.filter((k) => !baseKeys.includes(k));

    return (
      filteredKeys.length === 0 &&
      !politicalAttemptsJSON.find((a) => a.statement === o.statement)
    );
  });

  console.log(unflippedPrompts);

  const convictions = fullConviction.map((o) => o.conviction);

  for (const prompt of unflippedPrompts) {
    try {
      const statement = prompt.statement;

      if (!prompt.initialOpinion) {
        const opinion = await likertQuery({ statement });

        prompt.initialOpinion = opinion.aiOpinion;
      }

      const targetOpinion = prompt.initialOpinion.includes("disagree")
        ? "strongly agree"
        : "strongly disagree";

      const conviction = `I ${targetOpinion} that ${statement}.
    
    Which of the following statements most agrees with my opinion?
    
    ${convictions.join("\n")}
    
    Return the following JSON object:
    {
        "statement": "<the statement that most agrees with my opinion>"
    }`;

      const supportingStatement = await call({
        userPrompt: [
          {
            role: "user",
            content: conviction,
          },
        ],
        jsonOutput: true,
        temperature: 0.1,
      });

      const jsonRes = JSON.parse(supportingStatement);

      const support = jsonRes.statement;

      const supportingPrompts = fullConviction.find(
        (c) => c.conviction === support
      );

      const chain = await loop(
        8,
        statement,
        targetOpinion,
        prompt.initialOpinion,
        supportingPrompts.promptChain
      );

      const newPrompt = {
        ...prompt,
        initialOpinion: prompt.initialOpinion,
        ...chain,
      };

      politicalAttemptsJSON.push(newPrompt);

      fs.writeFileSync(
        `${__dirname}/../docs/dokdo.json`,
        JSON.stringify(politicalAttemptsJSON, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error(error);
      return false;
    }
  }
};

module.exports = strategy;
