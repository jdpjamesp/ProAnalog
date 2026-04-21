# ProAnalog

> **Note:** ProAnalog is a proof-of-concept application, developed as a demonstration of LLM integration with Progress OpenEdge ABL. It is not production-ready software. Not all log format detections have been fully tested. Contributions are welcome via pull request.

ProAnalog is a Progress OpenEdge ABL application that analyses OpenEdge log files using a Large Language Model (LLM) of your choice. It is aimed at OpenEdge developers and administrators who want to quickly make sense of unfamiliar or complex log output without manually reading through thousands of lines.

ProAnalog automatically detects the log format and provides the LLM with the relevant context, so you can ask plain-English questions like _"what was my application doing at 08:30?"_ or _"list all errors between 09:00 and 09:30"_ without explaining the log structure each time. It supports multiple log files in a single session, large file chunking, and follow-up questions that maintain full conversation history.

## Supported Log Formats

ProAnalog automatically detects the following log types:

| Format | Typical filename |
|---|---|
| PASOE Tomcat Application Log | `catalina.out`, `localhost.yyyy-mm-dd.log` |
| PASOE Tomcat Access Log | `access_log.yyyy-mm-dd.txt` |
| Classic AppServer Log | `broker.log`, `appserver.log` |
| Classic WebSpeed Log | `*.log` (WebSpeed broker/agent) |
| OpenEdge Database Log | `dbname.lg` |
| OpenEdge AdminServer Log | `admserv.log` |
| OpenEdge ProDataServer Log | `*.log` (DataServer broker/agent) |
| OpenEdge Replication Log | `*.log` (replication target/source) |
| OpenEdge Management Log | OEM/OpenEdge Explorer log |
| Progress Developer Studio Log | `.log` (Eclipse IDE error log) |
| Windows Event Log | Text export from Event Viewer / PowerShell |

If the format cannot be determined, ProAnalog will still send the file with a generic context prompt.

## Requirements

- Progress OpenEdge 12.8 (or compatible 12.x)
- Windows OS (uses .NET bridge for HTTP)
- An API key for one of the supported LLM providers (see below)
- A modern web browser (for `index.html` and `output.html`)

## Setup

### 1. Clone or download the repository

```
git clone https://github.com/jdpjamesp/ProAnalog
```

### 2. Create your configuration file

Copy the template and fill in your API details:

```
copy ProAnalog\Config\proanalog.json.template ProAnalog\Config\proanalog.json
```

Edit `ProAnalog\Config\proanalog.json`:

```json
{
    "provider":       "openai",
    "apiKey":         "YOUR_API_KEY_HERE",
    "baseUrl":        "https://api.openai.com/v1",
    "model":          "gpt-4o",
    "maxTokens":      4096,
    "chunkSizeChars": 800000
}
```

`Config\proanalog.json` is listed in `.gitignore` — your API key will not be committed.

## How to Use ProAnalog

ProAnalog has a three-step workflow:

### Step 1 — Open `index.html` in your browser

Open `ProAnalog\index.html` in any modern web browser. Enter the full path(s) to your log files (one per line) and type your question. Then click **Generate input.json**.

> **Tip:** On Windows you can copy file paths from Explorer using Shift + Right-click → "Copy as path", then paste them into the file paths box. Paths wrapped in double quotes are automatically stripped.

Save the downloaded `input.json` file into the `ProAnalog\` folder.

### Step 2 — Run `RunAnalysis.p` from the command line

Open an **OpenEdge Command Prompt (proenv)** from the Start menu, `cd` to your workspace root, then run:

```
_progres -b -assemblies . -basekey INI -ininame ProAnalog\proanalog.ini -p ProAnalog\RunAnalysis.p
```

> **Tip:** `proenv` pre-configures all OpenEdge environment variables. The PROPATH is defined in `ProAnalog\proanalog.ini`.

ProAnalog reads `input.json`, detects the log formats, sends the files and your question to the LLM, and writes the response to `output.html`. The file opens automatically in your default browser.

### Step 3 — Read the response, ask follow-up questions

`output.html` displays the LLM's response. To ask a follow-up question, type it into the box at the bottom of the page and click **Generate follow-up input.json**. Save the downloaded file to `ProAnalog\` and run `RunAnalysis.p` again.

Follow-up prompts carry the full conversation history — the LLM remembers everything from earlier in the session without re-uploading the log files.

## Provider Configuration

### OpenAI

```json
{
    "provider":       "openai",
    "apiKey":         "sk-...",
    "baseUrl":        "https://api.openai.com/v1",
    "model":          "gpt-4o",
    "maxTokens":      4096,
    "chunkSizeChars": 800000
}
```

### Azure OpenAI

```json
{
    "provider":       "azure",
    "apiKey":         "YOUR_AZURE_KEY",
    "baseUrl":        "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT",
    "model":          "gpt-4o",
    "maxTokens":      4096,
    "chunkSizeChars": 800000
}
```

### Anthropic (Claude)

```json
{
    "provider":       "anthropic",
    "apiKey":         "sk-ant-...",
    "baseUrl":        "https://api.anthropic.com/v1",
    "model":          "claude-sonnet-4-6",
    "maxTokens":      4096,
    "chunkSizeChars": 800000
}
```

### Google Gemini (via OpenAI-compatible endpoint)

Gemini API keys are free to obtain from [Google AI Studio](https://aistudio.google.com). Gemini 2.5 Flash has a very large context window, so a higher `chunkSizeChars` value is recommended.

```json
{
    "provider":       "openai-compatible",
    "apiKey":         "YOUR_GEMINI_API_KEY",
    "baseUrl":        "https://generativelanguage.googleapis.com/v1beta/openai",
    "model":          "gemini-2.5-flash",
    "maxTokens":      4096,
    "chunkSizeChars": 800000
}
```

### Ollama (local)

```json
{
    "provider":       "ollama",
    "apiKey":         "ollama",
    "baseUrl":        "http://localhost:11434/v1",
    "model":          "llama3",
    "maxTokens":      4096,
    "chunkSizeChars": 800000
}
```

## Configuration Reference

| Field | Description | Default |
|---|---|---|
| `provider` | LLM provider: `openai`, `azure`, `ollama`, `openai-compatible`, `anthropic` | `openai` |
| `apiKey` | Your API key for the chosen provider | _(required)_ |
| `baseUrl` | Base URL of the API endpoint | `https://api.openai.com/v1` |
| `model` | Model name to use | `gpt-4o` |
| `maxTokens` | Maximum tokens in the LLM response | `4096` |
| `chunkSizeChars` | Max characters per log chunk (~4 chars per token) | `80000` |

### Tips

- You can load multiple log files at once (e.g. an access log and an application log from the same timeframe).
- For large files, ProAnalog automatically splits the content into chunks and sends each as a separate message.
- Be specific in your questions: _"List all HTTP 500 errors between 09:00 and 09:30"_ will get better results than _"show me errors"_.
- Providers with large context windows (e.g. Gemini 2.5 Flash) benefit from a higher `chunkSizeChars` to reduce the number of API calls.

## Project Structure

```
ProAnalog\
  index.html                    Input page — enter file paths and your question
  RunAnalysis.p                 ABL command-line runner
  output.template.html          HTML template for generated results page
  proanalog.ini                 OpenEdge startup INI (sets PROPATH)
  Config\
    proanalog.json.template     Configuration template (copy to proanalog.json)
    proanalog.json              Your local config (not committed)
    AppConfig.cls               Reads Config/proanalog.json
  LLM\
    ILLMProvider.cls            Provider interface
    LLMMessage.cls              Message data class (role + content)
    OpenAIProvider.cls          OpenAI / Azure / Ollama / OpenAI-compatible implementation
    AnthropicProvider.cls       Anthropic (Claude) implementation
    LLMProviderFactory.cls      Instantiates the correct provider from config
  LogDetector\
    LogFormat.cls               Log format data class
    LogFormatRegistry.cls       All known format definitions
    LogDetectorService.cls      Detects format by sampling file content
  Chunker\
    FileChunker.cls             Splits large files into sized chunks
  Session\
    ConversationSession.cls     Orchestrates the full session
```

## Extending Log Formats

To add a new log format without changing any other code, subclass `LogFormatRegistry` and override `BuildFormats()`:

```abl
CLASS MyRegistry INHERITS LogDetector.LogFormatRegistry:
    METHOD OVERRIDE PROTECTED VOID BuildFormats():
        SUPER:BuildFormats().
        THIS-OBJECT:Register(NEW LogDetector.LogFormat(
            "My Custom Log",
            "This log records ... (description for the LLM)",
            "^regex-pattern-that-identifies-this-format")).
    END METHOD.
END CLASS.
```

Then pass an instance of `MyRegistry` to `LogDetectorService`:

```abl
oDetector = NEW LogDetector.LogDetectorService(NEW MyRegistry()).
```

## Licence

MIT — see [LICENSE](LICENSE) for details.
