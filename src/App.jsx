import React, { useState, useEffect, useRef } from "react";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SyncLoader } from "react-spinners";


export default function ChatStream() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  // Rolagem automática para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      content: input,
      type: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("http://localhost:8000/chat/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "1", message: input }),
      });

      if (!response.body) {
        console.error("Streaming não suportado!");
        setIsStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = chunk.split("\n\n");

        for (let event of events) {
          if (!event.startsWith("data:")) continue;

          const data = event.replace("data:", "").trim();
          if (data === "[DONE]") {
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // Nova mensagem do assistente completa
            if (parsed.type === "assistant_message") {
              const assistantMessage = {
                content: parsed.content,
                type: "assistant",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };

              setMessages(prev => [...prev, assistantMessage]);
            }

            // 🟣 Atualização token por token (opcional)
            else if (parsed.type === "token") {
              setMessages(prev => {
                const newMessages = [...prev];
                const last = newMessages[newMessages.length - 1];
                if (last && last.type === "assistant") {
                  last.content += parsed.content;
                } else {
                  newMessages.push({
                    content: parsed.content,
                    type: "assistant",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  });
                }
                return newMessages;
              });
            }

          } catch (err) {
            console.warn("Não consegui parsear:", data);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setIsStreaming(false);
    }
  };


  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen antialiased text-gray-800">
      <div className="flex flex-row h-full w-full overflow-x-hidden">
        {/* Sidebar */}
        <div className="flex flex-col py-8 pl-6 pr-2 w-64 bg-white flex-shrink-0">
          <div className="flex flex-row items-center justify-center h-12 w-full">
            <div className="flex items-center justify-center rounded-2xl text-indigo-700 bg-indigo-100 h-10 w-10">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                ></path>
              </svg>
            </div>
            <div className="ml-2 font-bold text-2xl">AI Agent</div>
          </div>

          <div className="flex flex-col items-center bg-indigo-100 border border-gray-200 mt-4 w-full py-6 px-4 rounded-lg">
            <div className="h-20 w-20 rounded-full border overflow-hidden">
              <img
                src="https://avatars3.githubusercontent.com/u/2763884?s=128"
                alt="Avatar"
                className="h-full w-full"
              />
            </div>
            <div className="text-sm font-semibold mt-2">AI Assistant</div>
            <div className="text-xs text-gray-500">Powered by AI</div>
            <div className="flex flex-row items-center mt-3">
              <div className="flex flex-col justify-center h-4 w-8 bg-indigo-500 rounded-full">
                <div className="h-3 w-3 bg-white rounded-full self-end mr-1"></div>
              </div>
              <div className="leading-none ml-1 text-xs">Online</div>
            </div>
          </div>

          <div className="flex flex-col mt-8">
            <div className="flex flex-row items-center justify-between text-xs">
              <span className="font-bold">Chat Session</span>
              <span className="flex items-center justify-center bg-gray-300 h-4 w-4 rounded-full">
                {messages.filter(m => m.type === 'user').length}
              </span>
            </div>
            <div className="flex flex-col space-y-1 mt-4 -mx-2 h-48 overflow-y-auto">
              <div className="flex flex-row items-center justify-center p-2">
                <div className="text-xs text-gray-500">
                  {messages.length === 0 ? "No messages yet" : `${messages.length} messages`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Área principal do chat */}
        <div className="flex flex-col flex-auto h-full p-6">
          <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-gray-100 h-full p-4">
            <div className="flex flex-col h-full overflow-x-auto mb-4">
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-12 gap-y-2">
                  {messages.length === 0 ? (
                    <div className="col-span-12 flex justify-center items-center h-64">
                      <div className="text-center">
                        <div className="text-2xl text-gray-500 mb-2">💬</div>
                        <div className="text-gray-500">Send a message to start chatting with your AI agent</div>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`${msg.type === "user"
                            ? "col-start-6 col-end-13"
                            : "col-start-1 col-end-8"
                          } p-3 rounded-lg`}
                      >
                        <div className={`flex items-center ${msg.type === "user"
                            ? "justify-start flex-row-reverse"
                            : "justify-start"
                          }`}>
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500 flex-shrink-0 text-white">
                            {msg.type === "user" ? "U" : "AI"}
                          </div>
                          <div
                            className={`relative ${msg.type === "user" ? "mr-3 bg-indigo-100" : "ml-3 bg-white"
                              } text-sm py-2 px-4 shadow rounded-xl`}
                          >
                            <div className="markdown-content" >
                              <Markdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </Markdown>
                            </div>
                            <div className={`absolute text-xs bottom-0 ${msg.type === "user" ? "left-0 -mb-5 ml-2" : "right-0 -mb-5 mr-2"
                              } text-gray-500`}>
                              {msg.timestamp}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {isStreaming && (
                    <div className="col-start-1 col-end-8 p-3 rounded-lg">
                      <div className="flex items-center justify-start">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500 flex-shrink-0 text-white">
                          AI
                        </div>
                        <div className="relative ml-3 text-sm bg-white py-4 px-4 shadow rounded-xl">
                          <div className="flex items-center">
                            <SyncLoader
                              color={"#6366f1"}
                              loading={isStreaming}
                              size={7}
                              aria-label="Loading Spinner"
                              data-testid="loader"
                            />
                            {/* <div className="animate-pulse">Generating response...</div> */}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* Input area */}
            <div className="flex flex-row items-center h-16 rounded-xl bg-white w-full px-4">
              <div>
                <button className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    ></path>
                  </svg>
                </button>
              </div>

              <div className="flex-grow ml-4">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here..."
                    className="flex w-full border rounded-xl focus:outline-none focus:border-indigo-300 pl-4 h-10"
                    disabled={isStreaming}
                  />
                </div>
              </div>

              <div className="ml-4">
                <button
                  onClick={sendMessage}
                  disabled={isStreaming || !input.trim()}
                  className="flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 rounded-xl text-white px-4 py-1 flex-shrink-0 transition-colors duration-200"
                >
                  <span>Send</span>
                  <span className="ml-2">
                    <svg
                      className="w-4 h-4 transform rotate-45 -mt-px"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      ></path>
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}