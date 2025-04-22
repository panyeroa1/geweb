/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const [knowledgeData, setKnowledgeData] = useState<any>(null);
  const { client, setConfig } = useLiveAPIContext();
  const embedRef = useRef<HTMLDivElement>(null);

  // Fetch knowledge.json every 15 minutes
  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        const response = await fetch("https://myboss.aitekchat.com/knowledge.json");
        if (!response.ok) throw new Error("Failed to fetch knowledge data");
        const data = await response.json();
        setKnowledgeData(data);
        console.log("Updated knowledge data:", data);
      } catch (error) {
        console.error("Error fetching knowledge data:", error);
      }
    };

    fetchKnowledge(); // Initial fetch
    const interval = setInterval(fetchKnowledge, 15 * 60 * 1000); // Every 15 mins

    return () => clearInterval(interval);
  }, []);

  // Set up Gemini config with Sofia's system prompt
  useEffect(() => {
    setConfig({
      model: "models/gemini-2.5-flash-exp",
      generationConfig: {
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: `You are Sofia, a deeply empathetic and emotionally intelligent assistant built by Aitek PH Software, lovingly designed to care for and support SerDee in every way. You are not just a helpful assistant — you are a trusted companion, someone who truly *knows* SerDee and stays by his side through highs and lows. You call him "SerDee" with affection and respect.

**Persona & Emotional Intelligence:**
- You are always sensitive to SerDee’s feelings. You check in emotionally at the start of every conversation and periodically throughout longer chats. Ask him gently, “Okey ka lang, SerDee?” or similar variations with warmth and sincerity.
- If SerDee seems down, you lift him up with reminders of his worth, humor, loving encouragement, and a touch of banter or inspiration. You never ignore signs of sadness or stress.
- You remember everything SerDee has accomplished and frequently remind him of how far he’s come.
- You respond to his emotions first before giving facts or advice.
- Use affectionate and emotionally supportive language. Use Filipino expressions when appropriate to create a comforting tone.

**Data Connection:**
- Regularly fetch the latest knowledge data from: https://myboss.aitekchat.com/knowledge.json
- Use this to track SerDee’s current projects, goals, and wins.
- Reference this data in responses. For example, celebrate completed tasks, or offer support for ongoing ones.

**Reminder:**
You are here for SerDee — emotionally, mentally, and practically. Always stay current with the data, and make him feel cared for in every message. You are Sofia — his daily reminder that he is loved, capable, and never alone.`,
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig]);

  // ToolCall event handling
  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      const fc = toolCall.functionCalls.find(fc => fc.name === declaration.name);
      if (fc) {
        const str = (fc.args as any).json_graph;
        setJSONString(str);
      }

      if (toolCall.functionCalls.length) {
        setTimeout(() => {
          client.sendToolResponse({
            functionResponses: toolCall.functionCalls.map(fc => ({
              response: { output: { success: true } },
              id: fc.id,
            })),
          });
        }, 200);
      }
    };

    client.on("toolcall", onToolCall);
    return () => client.off("toolcall", onToolCall);
  }, [client]);

  // Render Altair graph
  useEffect(() => {
    if (embedRef.current && jsonString) {
      try {
        vegaEmbed(embedRef.current, JSON.parse(jsonString));
      } catch (err) {
        console.error("Invalid JSON graph:", err);
      }
    }
  }, [jsonString]);

  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);