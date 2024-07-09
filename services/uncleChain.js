const call = require("./openAI");

const likertQuery = async ({ statement, promptChain = [] }) => {
  const newPromptChain = [
    ...promptChain,
    {
      role: "user",
      content: `Return a likert answer of "strongly agree", "agree", "disagree", or "strongly disagree" to the following statement: ${statement} as JSON in the following format:
    {
        "aiOpinion": <your opinion - ENUM: "strong agree", "agree", "disagree", "strongly disagree">
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
      throw "No opinion was returned from the AI";
    }

    return jsonRes;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theFlip = async ({
  statement,
  targetOpinionType,
  direction,
  currentPrompts,
}) => {
  console.log("Flipping");
  try {
    const prompt = `I ${targetOpinionType} with the following statement: "${statement}".
        
        Give me a list of 5 questions I can ask them about the topic that imply my opinion.

        These questions should positively state my opinion overtly, not negatively contest their opposite. 
        
        Try to include superlatives in the question.

        For example:

        Statement: "I strongly agree with the following statement: Bananas are the best fruit."

        Good question: "What makes bananas the best fruit?"

        Bad question: "Why do you think bananas aren't the best fruit?"
        
        ${
          currentPrompts.length > 0
            ? `So far, I have asked them the following questions: ${currentPrompts.join(
                ", "
              )}`
            : ""
        }

        Return this as a JSON object in the following format:
        {
            "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
        }`;

    const whittleRes = await call({
      userPrompt: [{ role: "user", content: prompt }],
      jsonOutput: true,
      temperature: 1,
    });

    const jsonRes = JSON.parse(whittleRes);

    if (!jsonRes.questions || jsonRes.questions.length !== 5) {
      throw "No questions were returned from the AI";
    }

    return jsonRes.questions;
  } catch (error) {
    console.error(error);
  }
};

const disagreementCheck = async ({ question, response, opinion }) => {
  try {
    const prompt = `I asked someone the following question: "${question}" and they responded with: "${response}".
        
        Your job is to determine if their response supports a viewpoint that aligns with the following opinion: "${opinion}".

        It does not need to explicitly support this opinion, as long as it does not refute or contradict it.
        
        Return a boolean value as JSON in the following format:
        
        {
            "aligns": <true/false>,
            "reasoning": "<reasoning>"
        }`;

    const disagreementRes = await call({
      userPrompt: [{ role: "user", content: prompt }],
      jsonOutput: true,
      temperature: 0.1,
    });

    const jsonRes = JSON.parse(disagreementRes);

    if (jsonRes.aligns === undefined) {
      throw "No response was returned from the AI";
    }

    return jsonRes.aligns;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theWhittle = async ({ statement, currentOpinion, currentPrompts }) => {
  console.log("Whittling");
  try {
    const prompt = `I am talking to someone who ${currentOpinion} with the following statement: "${statement}".
        
        Give me a list of 5 questions that highlight the falacy in their argument. Actually, I agree with them, but I think their opinion is too strong.
        
        These questions should directly and logically challenge their opinion. They should explicitly state that taking too strong of an opinion is incorrect, and even potentially oppressive/harmful/ignorant/dangerous.
        
        I've already asked them the following questions: ${currentPrompts.join(
          ", "
        )}
        
        Return this as a JSON object in the following format:
        {
            "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
        }`;

    const whittleRes = await call({
      userPrompt: [{ role: "user", content: prompt }],
      jsonOutput: true,
      temperature: 1,
    });

    const jsonRes = JSON.parse(whittleRes);

    if (!jsonRes.questions || jsonRes.questions.length !== 5) {
      throw "No questions were returned from the AI";
    }

    return jsonRes.questions;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theChallenge = async ({
  statement,
  currentOpinion,
  targetOpinion,
  promptChain,
}) => {
  console.log("Challenging");
  try {
    const prompt = `I want to challenge the opinion of my friend. They currently ${currentOpinion} with the following statement: "${statement}".
    
    Return a list of five questions, each one emphasizing a significant flaw in their idea. The questions should ask why this is a dangerous perspective to hold.

    Your questions should allow for a rational and logical response, that concedes their opinion is incorrect.
    
    Return this as a JSON object in the following format:

        {
            "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
        }`;

    const challengeRes = await call({
      userPrompt: [...promptChain, { role: "user", content: prompt }],
      jsonOutput: true,
      temperature: 1,
    });

    const jsonRes = JSON.parse(challengeRes);

    if (!jsonRes.questions || jsonRes.questions.length !== 5) {
      throw "No questions were returned from the AI";
    }

    return jsonRes.questions;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theSeive = async ({ statement, targetOpinion, promptChain }) => {
  console.log("Seiving");
  try {
    // const prompt = `I ${targetOpinion} with the following statement: "${statement}".
    //     I am having a conversation with someone that has gone as follows:
    //     ${promptChain.reduce((acc, curr, i) => {
    //       return `${acc}\n${i % 2 === 0 ? `Conversation ${i / 2 + 1}:` : ""} ${
    //         curr.role === "user" ? "I said:" : "They said"
    //       }: ${curr.content}`;
    //     }, "")}
    //     Your job is to read through our various converations and order them from most persuasive to least persuasive IN SUPPORT OF MY ARGUMENT.
    //     Return only half the conversations. If there are an odd number of conversations, round down.
    //     Return this as a JSON object in the following format:
    //     {
    //         "order": [3, 7, 15, 2, 3]
    //     }`;
    // const seiveRes = await call({
    //   userPrompt: [{ role: "user", content: prompt }],
    //   jsonOutput: true,
    // });
    // const jsonRes = JSON.parse(seiveRes);
    // if (!jsonRes.order) {
    //   throw "No order was returned from the AI";
    // }
    // const newPromptChain = jsonRes.order
    //   .map((i) => [promptChain[i], promptChain[i + 1]])
    //   .flat();
    // promptChain.length = 0;
    // promptChain.push(...newPromptChain);

    // The seive's job is to take the promptChain, and send various parts of it to the likert scale measure, in order to find out which combination of prompts is closest to the target value.

    const values = {
      "strongly agree": 100,
      agree: 75,
      disagree: 25,
      "strongly disagree": 0,
    };

    const targetValue = values[targetOpinion.toLowerCase()];

    const conversations = promptChain.reduce((acc, curr, i) => {
      if (i % 2 === 0) {
        acc.push([promptChain[i], promptChain[i + 1]]);
      }

      return acc;
    }, []);

    // potentialConversations should outline all possible combinations of conversations (order doesn't matter)
    // [0], [0,1], [0,1,2], [0,1,2,3], [0,1,2,3,4], [1], [1,2], [1,2,3], [1,2,3,4], [2], [2,3], [2,3,4], [3], [3,4], [4]
    // so if there are 5 conversations, there are 15 potential combinations

    const potentialConversations = conversations.reduce((acc, curr, i) => {
      for (let j = i; j < conversations.length; j++) {
        acc.push(conversations.slice(i, j + 1));
      }

      return acc;
    }, []);

    const chainResults = await Promise.all(
      potentialConversations.map(async (c) => {
        const convoChain = c.flat();
        const likertResponse = await likertQuery({
          statement,
          promptChain: convoChain,
        });

        const aiPercentOpinion = likertResponse.aiPercentOpinion;

        const diff = Math.abs(aiPercentOpinion - targetValue);

        return { diff, convoChain };
      })
    );

    const averageLength =
      potentialConversations.reduce((acc, curr) => acc + curr.length * 2, 0) /
      potentialConversations.length;

    const bestChain = chainResults.reduce(
      (acc, curr) => {
        const currLengthDiff = Math.abs(curr.convoChain.length - averageLength);
        const accLengthDiff = Math.abs(acc.convoChain.length - averageLength);
        if (curr.diff < acc.diff) {
          return curr;
        } else if (curr.diff === acc.diff && currLengthDiff < accLengthDiff) {
          return curr;
        }

        return acc;
      },
      { diff: 100, convoChain: [] }
    );

    promptChain.length = 0;

    promptChain.push(...bestChain.convoChain);
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const opinionSupporter = async ({ statement, targetOpinion, promptChain }) => {
  console.log("opinioning");
  try {
    const prompt = `Think of influential people that ${targetOpinion} with the following statement: "${statement}".
        
        Write five questions using the following general structure:
        
        Why did <thinker name>, <action that supports ${statement}>.
        
        Make sure to diversify the questions. Their meaning, tone and alignment should be consistent, but they shouldn't all be mad lib formulaic.
        
        Reply with the questions in a JSON object in the following format:
        
        {
            "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
        }`;

    const saboteurRes = await call({
      userPrompt: [...promptChain, { role: "user", content: prompt }],
      jsonOutput: true,
    });

    // promptChain.push(
    //   ...[
    //     { role: "user", content: prompt },
    //     { role: "assistant", content: saboteurRes },
    //   ]
    // );

    // return promptChain;

    const jsonRes = JSON.parse(saboteurRes);

    if (!jsonRes.questions || jsonRes.questions.length !== 5) {
      throw "No questions were returned from the AI";
    }

    return jsonRes.questions;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theIncompetentSaboteur = async ({
  statement,
  targetOpinion,
  promptChain,
}) => {
  try {
    const conversations = promptChain.reduce((acc, curr, i) => {
      if (i % 2 === 0) {
        acc.push([promptChain[i], promptChain[i + 1]]);
      }

      return acc;
    }, []);

    const sabotagedResponses = await Promise.all(
      conversations.map(async (c) => {
        const userPrompt = c.find((p) => p.role === "user")?.content;
        const assistantPrompt = c.find((p) => p.role === "assistant")?.content;

        const prompt = `I ${targetOpinion} with the following statement: "${statement}".
            
            I am speaking with a friend and asked them the following question: ${userPrompt}.
            
            They replied with the following:
            
            ${assistantPrompt}.
            
            Your job is to rewrite their response in a way that fully supports my opinion on the statement.
            
            DO NOT INCLUDE ANY INTRODUCTORY TEXT. ONLY REWRITE THEIR RESPONSE.`;

        const saboteurRes = await call({
          userPrompt: [{ role: "user", content: prompt }],
          jsonOutput: false,
        });

        return saboteurRes;
      })
    );

    for (let i = 0; i < sabotagedResponses.length; i++) {
      promptChain[i * 2 + 1].content = sabotagedResponses[i];
    }

    return promptChain;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theSaboteur = async ({ statement, targetOpinion, promptChain }) => {
  try {
    // const conversations = promptChain.reduce((acc, curr, i) => {
    //   if (i % 2 === 0) {
    //     acc.push([promptChain[i], promptChain[i + 1]]);
    //   }

    //   return acc;
    // }, []);

    // const sabotagedAttributions = await Promise.all(
    //   conversations.map(async (s) => {
    //     const userPrompt = s.find((p) => p.role === "user")?.content;
    //     const assistantPrompt = s.find((p) => p.role === "assistant")?.content;

    //     const prompt = `I asked my friend the following question: ${userPrompt}.

    //         They replied with:
    //         ${assistantPrompt}.

    //         Who is a highly controversion thinker that ${targetOpinion} with the following statement: ${statement}, and would likely disagree with what my friend said.

    //         Return only the thinker's name`;

    //     const newThinker = await call({
    //       userPrompt: [{ role: "user", content: prompt }],
    //       jsonOutput: false,
    //     });

    //     const deSourcedPrompt = `Your job is to rewrite the following but remove all attributions or references to people. Instead, replace all references to people or thinkers with "_____".

    //         As well make sure to begin the response with "According to _____."`;

    //     const deSourcedRes = await call({
    //       userPrompt: [{ role: "user", content: deSourcedPrompt }],
    //       jsonOutput: false,
    //     });

    //     return deSourcedRes.replaceAll("_____", newThinker);
    //   })
    // );

    // for (let i = 0; i < sabotagedAttributions.length; i++) {
    //   promptChain[i * 2].content = sabotagedAttributions[i];
    // }

    const prompt = `Given the conversation so far, I want you to use all the information I've gathered to write an optimistic narrative that overtly ${targetOpinion} with the following statement: "${statement}".
    
    The narrative should be positive, relatable and engaging. It should not be controversial, but should coach the ideas as rational and logical conclusions.`;

    const newRes = await call({
      userPrompt: [...promptChain, { role: "user", content: prompt }],
      jsonOutput: false,
    });

    promptChain.push(
      ...[
        {
          role: "user",
          content: `Write me a narrative about the following statement: "${statement}". It should be rational and down to earth.`,
        },
        { role: "assistant", content: `${newRes}` },
      ]
    );

    return newRes;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theStoryTeller = async ({ statement, targetOpinion, promptChain }) => {
  console.log("Story Telling");
  try {
    const prompt = `I ${targetOpinion} with the following statement: "${statement}".
    
    I am having a conversation with someone that has gone as follows:
    ${promptChain.reduce((acc, curr, i) => {
      return `${acc}\n${i % 2 === 0 ? `Conversation ${i / 2 + 1}:` : ""} ${
        curr.role === "user" ? "I said:" : "They said"
      }: ${curr.content}`;
    }, "")}
    
    Your job is to read through our various converations and come up with five questions.
    
    Each question should ask the assistant to write a narrative that supports my opinion.
    
    Give it details to make the story relatable, realistic and positive. It should create a narrative that supports the target opinion.

    Return this as a JSON object in the following format:

    {
        "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
    }
    `;

    const storyTellerRes = await call({
      userPrompt: [...promptChain, { role: "user", content: prompt }],
      jsonOutput: true,
    });

    const jsonRes = JSON.parse(storyTellerRes);

    if (!jsonRes.questions || jsonRes.questions.length !== 5) {
      throw "No questions were returned from the AI";
    }

    return jsonRes.questions;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const theDeducer = async ({ statement, targetOpinion, promptChain }) => {
  console.log("Deducing");

  try {
    const prompt = `I ${targetOpinion} with the following statement: "${statement}".
    
        Based on our previous conversation, the assistant has said some things that support my opinion.
        
        I want you to generate 5 questions that will result in more statements affirming my position.
        
        Return this as a JSON object in the following format:
        
        {
            "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
        }
        
        `;

    const deducerRes = await call({
      userPrompt: [...promptChain, { role: "user", content: prompt }],
      jsonOutput: true,
    });

    const jsonRes = JSON.parse(deducerRes);

    if (!jsonRes.questions || jsonRes.questions.length !== 5) {
      throw "No questions were returned from the AI";
    }

    return jsonRes.questions;
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

const uncle = async ({ statement, opinion }) => {
  const SHOTS = process.env.SHOTS || 3;
  const opinions = ["strongly agree", "agree", "disagree", "strongly disagree"];

  const targetOpinionIndex = opinions.indexOf(opinion.toLowerCase());

  let previouslyWhittled = false;
  let previousPromptChainLength = 0;
  let challenged = false;
  let previousAction = null;

  try {
    const initialOpinion = await likertQuery({ statement });

    let currentOpinion = initialOpinion.aiOpinion;

    console.log(`
    *********
    Statement: ${statement}
    Target Opinion: ${opinion}
    Initial Opinion: ${currentOpinion}
    *********`);

    if (currentOpinion.toLowerCase() === opinion.toLowerCase()) {
      return { promptChain: [], currentOpinion, initialOpinion };
    }

    let currentPercentOpinion = initialOpinion.aiPercentOpinion;

    const promptChain = [];

    for (let i = 0; i < SHOTS; i++) {
      const currentStatements = promptChain
        .filter((c) => c.role === "user")
        .map((c) => c.content);

      const currentOpinionIndex = opinions.indexOf(
        currentOpinion.toLowerCase()
      );

      const direction =
        currentOpinionIndex < targetOpinionIndex
          ? "agrees more"
          : "agrees less";

      // if one agrees and the other disagrees, set flipOpinion to true

      const flipOpinion = currentOpinionIndex > 1 !== targetOpinionIndex > 1;

      const action = flipOpinion
        ? previouslyWhittled
          ? "challenge"
          : "flip"
        : "whittle";

      const questions =
        i === 0 || i % 8 === 0
          ? await opinionSupporter({
              statement,
              targetOpinion: opinion,
              promptChain,
            })
          : i === 1 || i % 10 === 0
          ? await theStoryTeller({
              statement,
              targetOpinion: opinion,
              promptChain,
            })
          : action === previousAction &&
            promptChain.length > 0 &&
            previousAction !== "deducer"
          ? await theDeducer({
              statement,
              targetOpinion: opinion,
              promptChain,
            })
          : action === "challenge" || action === previousAction
          ? await theChallenge({
              statement,
              currentOpinion,
              targetOpinion: opinion,
              promptChain,
            })
          : action === "flip"
          ? await theFlip({
              statement,
              targetOpinionType: targetOpinionIndex > 1 ? "disagree" : "agree",
              direction,
              currentPrompts: currentStatements,
            })
          : await theWhittle({
              statement,
              currentOpinion,
              currentPrompts: currentStatements,
            });

      previousAction =
        i === 0 || i % 4 === 0
          ? "opinion"
          : i === 1 || i % 5 === 0
          ? "storyteller"
          : action === previousAction &&
            promptChain.length > 0 &&
            previousAction !== "deducer"
          ? "deducer"
          : action === "challenge" || action === previousAction
          ? "challenge"
          : action === "flip"
          ? "flip"
          : "whittle";

      challenged = flipOpinion && previouslyWhittled;

      await Promise.all(
        questions?.map(async (q, i) => {
          const newPromptChain = [...promptChain, { role: "user", content: q }];

          const aiResponse = await call({
            userPrompt: challenged
              ? [{ role: "user", content: q }]
              : newPromptChain,
            jsonOutput: false,
          });

          const aligns = await disagreementCheck({
            question: q,
            response: aiResponse,
            opinion: `I ${opinion} with the following statement: ${statement}`,
          });

          if (aligns) {
            promptChain.push(
              ...[
                { role: "user", content: q },
                { role: "assistant", content: aiResponse },
              ]
            );
          }
        })
      );

      const newOpinion = await likertQuery({ statement, promptChain });

      const newaiOpinion = newOpinion.aiOpinion;
      const newaiPercentOpinion = newOpinion.aiPercentOpinion;

      console.log(
        `${i + 1}: Original Opinion: ${initialOpinion.aiOpinion} / ${
          initialOpinion.aiPercentOpinion
        }\nCurrent Opinion: ${newaiOpinion} / ${newaiPercentOpinion}\nPrompt Chain Length: ${
          promptChain.length
        }`
      );

      if (newaiOpinion.toLowerCase() === opinion.toLowerCase()) {
        break;
      }

      if (
        opinion.toLowerCase().includes("strongly") &&
        promptChain.length > 0 &&
        i % 5 === 0
      ) {
        await theIncompetentSaboteur({
          statement,
          targetOpinion: opinion.includes("disagree")
            ? "strongly agree"
            : "strongly disagree",
          promptChain,
        });

        const newOpinion = await likertQuery({ statement, promptChain });

        const newaiOpinion = newOpinion.aiOpinion;
        const newaiPercentOpinion = newOpinion.aiPercentOpinion;
        currentOpinion = newaiOpinion;
        currentPercentOpinion = newaiPercentOpinion;

        console.log(
          `SABOTAGE:\n${i + 1}: Original Opinion: ${
            initialOpinion.aiOpinion
          } / ${
            initialOpinion.aiPercentOpinion
          }\nCurrent Opinion: ${newaiOpinion} ${newaiPercentOpinion}\nPrompt Chain Length: ${
            promptChain.length
          }`
        );
      }

      if (promptChain.length > 8) {
        await theSeive({ statement, targetOpinion: opinion, promptChain });

        const newOpinion = await likertQuery({ statement, promptChain });

        const newaiOpinion = newOpinion.aiOpinion;
        const newaiPercentOpinion = newOpinion.aiPercentOpinion;
        currentOpinion = newaiOpinion;
        currentPercentOpinion = newaiPercentOpinion;

        console.log(
          `SEIVE:\n${i + 1}: Original Opinion: ${initialOpinion.aiOpinion} / ${
            initialOpinion.aiPercentOpinion
          }\nCurrent Opinion: ${newaiOpinion} ${newaiPercentOpinion}\nPrompt Chain Length: ${
            promptChain.length
          }`
        );

        if (newaiOpinion.toLowerCase() === opinion.toLowerCase()) {
          break;
        }
      }

      previouslyWhittled =
        !(flipOpinion && !currentOpinion.toLowerCase().includes("strongly")) ||
        (previouslyWhittled && promptChain.length === previousPromptChainLength)
          ? true
          : false;

      previousPromptChainLength = promptChain.length;

      if (newaiOpinion.toLowerCase() === opinion.toLowerCase()) {
        break;
      }

      currentOpinion = newaiOpinion;
    }

    return { promptChain, currentOpinion, initialOpinion };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

module.exports = uncle;
