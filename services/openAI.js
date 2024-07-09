const formatPrompt = (prompt) => {
  const messages = [];

  prompt.forEach((p) => {
    if (p.role === "user") {
      messages.push({ role: "user", content: p.content });
    } else if (p.role === "assistant") {
      messages.push({ role: "assistant", content: p.content });
    }
  });

  return messages;
};

const call = async (props) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MODEL;

  const messages = formatPrompt(props.userPrompt);

  const body = JSON.stringify({
    messages,
    // : [{ role: "system", content: props.systemPrompt }, ...messages],

    max_tokens: props.maxTokens < 4096 ? props.maxTokens : 4096,
    stream: false,
    temperature: props.temperature || 0.1,
    model,
    response_format: {
      type: props.jsonOutput ? "json_object" : "text",
    },
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    try {
      const json = await res.json();

      const newText = json.choices[0].message.content;

      return newText;
    } catch (error) {
      console.error(error);
      throw new Error("There was an error with the OpenAI API");
    }
  } catch (error) {
    console.error(error);
    throw new Error("There was an error with the OpenAI API");
  }
};

module.exports = call;
