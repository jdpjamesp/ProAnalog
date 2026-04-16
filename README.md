# ProAnalog

ProAnalog is a Progress OpenEdge ABL application that allows you to load OpenEdge log files and analyse them interactively using an LLM (Large Language Model) of your choice. ProAnalog automatically detects the log format and provides the LLM with the context it needs, so you can simply ask questions like _"what was my application doing at 08:30?"_ without having to explain the log structure every time.

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
- Windows OS (uses .NET bridge for HTTP and file dialogs)
- An API key for one of the supported LLM providers (see below)

## Setup

### 1. Clone or download the repository

```
git clone https://github.com/jdpjamesp/ProAnalog
```

### 2. Create your configuration file

Copy the template and fill in your API details:

```
copy Config\proanalog.json.template Config\proanalog.json
```

Edit `Config\proanalog.json`:

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

Ensure the ProAnalog project root directory is on your OpenEdge PROPATH so that ABL can resolve the class packages (`Config`, `LLM`, `LogDetector`, `Chunker`, `Session`).

In your `openedge-project.json` or launch configuration, add the project root to `propath`.

### 4. Run the application

Open and run `ProAnalog.w` in the Progress Developer Studio (or AppBuilder), or compile and run from the command line:

```
_progres -basekey INI -ininame openedge.ini -p ProAnalog.w
```

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

## Using ProAnalog

1. Launch `ProAnalog.w`
2. Click **Load Log File(s)...** and select one or more log files
3. ProAnalog detects the format of each file and displays the results
4. Type a question in the input box and press **Send** (or Ctrl+Enter)
5. The LLM response appears in the conversation panel
6. Continue asking follow-up questions — the full conversation history is maintained
7. Click **New Session** to clear everything and start fresh

### Tips

- You can load multiple log files at once (e.g. an access log and an application log from the same timeframe) — ProAnalog provides context for all of them in a single session.
- For large files, ProAnalog automatically splits the content into chunks. You will see a note in the conversation panel when chunking occurs.
- Be specific in your questions: _"List all HTTP 500 errors between 09:00 and 09:30"_ will get better results than _"show me errors"_.

## Project Structure

```
ProAnalog/
  ProAnalog.w                   Main GUI window
  Config/
    proanalog.json.template     Configuration template (copy to proanalog.json)
    proanalog.json              Your local config (not committed to source control)
    AppConfig.cls               Reads Config/proanalog.json
  LLM/
    ILLMProvider.cls            Provider interface
    LLMMessage.cls              Message data class (role + content)
    OpenAIProvider.cls          OpenAI / Azure / Ollama implementation
    AnthropicProvider.cls       Anthropic (Claude) implementation
    LLMProviderFactory.cls      Instantiates the correct provider from config
  LogDetector/
    LogFormat.cls               Log format data class
    LogFormatRegistry.cls       All known format definitions
    LogDetectorService.cls      Detects format by sampling file content
  Chunker/
    FileChunker.cls             Splits large files into sized chunks
  Session/
    ConversationSession.cls     Orchestrates the full session
```

## Extending Log Formats

To add a new log format without changing any other code, subclass `LogFormatRegistry` and override `BuildFormats()`:

```abl
CLASS MyRegistry INHERITS LogDetector.LogFormatRegistry:
    METHOD OVERRIDE PROTECTED VOID BuildFormats():
        SUPER:BuildFormats().  /* keep all built-in formats */
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
