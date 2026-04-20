# ProAnalog

ProAnalog is a Progress OpenEdge ABL application that allows you to load OpenEdge log files and analyse them using an LLM (Large Language Model) of your choice. ProAnalog automatically detects the log format and provides the LLM with the context it needs, so you can ask questions like _"what was my application doing at 08:30?"_ without explaining the log structure every time.

## Supported Log Formats

ProAnalog automatically detects the following log types:

| Format | Typical filename |
|---|---|
| PASOE Tomcat Application Log | `catalina.out`, `localhost.yyyy-mm-dd.log` |
| PASOE Tomcat Access Log | `access_log.yyyy-mm-dd.txt` |
| Classic WebSpeed Log | `*.log` (WebSpeed broker/agent) |
| OpenEdge Database Log | `dbname.lg` |

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
    "chunkSizeChars": 80000
}
```

`Config\proanalog.json` is listed in `.gitignore` — your API key will not be committed.

### 3. Configure your propath

Ensure `openedge-project.json` is in the workspace root. The project is pre-configured with the correct build path and propath entries. If running from the command line without the IDE, set your PROPATH to include the workspace root (the folder containing `ProAnalog\`).

## How to Use ProAnalog

ProAnalog has a three-step workflow:

### Step 1 — Open `index.html` in your browser

Open `ProAnalog\index.html` in any modern web browser. Enter the full path(s) to your log files (one per line) and type your question. Then click **Generate input.json**.

> **Tip:** On Windows you can drag files from Explorer directly into the file paths box to auto-fill their paths.

Save the downloaded `input.json` file into the `ProAnalog\` folder.

### Step 2 — Run `RunAnalysis.p` from the command line

Open an **OpenEdge Command Prompt (proenv)** from the Start menu, `cd` to your workspace root, then run:

```
_progres -b -assemblies . -propath ".,ProAnalog,%DLC%\gui\netlib\OpenEdge.net.pl" -p ProAnalog\RunAnalysis.p
```

> **Tip:** `proenv` pre-configures `%DLC%` and all OpenEdge environment variables so you don't need to set them manually.

ProAnalog reads `input.json`, detects the log formats, sends the files and your question to the LLM, and writes the response to `output.html`. The file opens automatically in your default browser.

### Step 3 — Read the response, ask follow-up questions

`output.html` displays the LLM's response. To ask a follow-up question, type it into the box at the bottom of the page and click **Generate follow-up input.json**. Save the downloaded file to `ProAnalog\` and run `RunAnalysis.p` again.

Follow-up prompts carry the full conversation history — the LLM remembers everything from earlier in the session without re-uploading the log files.

## Provider Configuration

### OpenAI

```json
{
    "provider":  "openai",
    "apiKey":    "sk-...",
    "baseUrl":   "https://api.openai.com/v1",
    "model":     "gpt-4o"
}
```

### Azure OpenAI

```json
{
    "provider":  "azure",
    "apiKey":    "YOUR_AZURE_KEY",
    "baseUrl":   "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT",
    "model":     "gpt-4o"
}
```

### Anthropic (Claude)

```json
{
    "provider":  "anthropic",
    "apiKey":    "sk-ant-...",
    "baseUrl":   "https://api.anthropic.com/v1",
    "model":     "claude-opus-4-6"
}
```

### Ollama (local)

```json
{
    "provider":  "ollama",
    "apiKey":    "ollama",
    "baseUrl":   "http://localhost:11434/v1",
    "model":     "llama3"
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
- For large files, ProAnalog automatically splits the content into chunks.
- Be specific in your questions: _"List all HTTP 500 errors between 09:00 and 09:30"_ will get better results than _"show me errors"_.

## Project Structure

```
ProAnalog\
  index.html                    Input page — select files and enter your question
  RunAnalysis.p                 ABL command-line runner
  output.template.html          HTML template for generated results page
  Config\
    proanalog.json.template     Configuration template (copy to proanalog.json)
    proanalog.json              Your local config (not committed)
    AppConfig.cls               Reads Config/proanalog.json
  LLM\
    ILLMProvider.cls            Provider interface
    LLMMessage.cls              Message data class (role + content)
    OpenAIProvider.cls          OpenAI / Azure / Ollama implementation
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
