/*------------------------------------------------------------------------
    File        : Config/AppConfig.cls
    Purpose     : Reads proanalog.json and exposes configuration values
                  to the rest of the application.
    Syntax      : Config.AppConfig
    Notes       : Uses .NET System.IO and System.Text.Json for JSON parsing.
                  Config file is expected at Config/proanalog.json relative
                  to the current working directory.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING System.IO.File          FROM ASSEMBLY.
USING System.Text.Json.*      FROM ASSEMBLY.

CLASS Config.AppConfig:

    /* Path to config file, relative to working directory */
    DEFINE PRIVATE STATIC VARIABLE CONFIG-FILE AS CHARACTER
        INITIAL "Config/proanalog.json" NO-UNDO.

    /* ------------------------------------------------------------------ */
    /* Properties                                                           */
    /* ------------------------------------------------------------------ */

    DEFINE PUBLIC PROPERTY Provider AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    DEFINE PUBLIC PROPERTY ApiKey AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    DEFINE PUBLIC PROPERTY BaseUrl AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    DEFINE PUBLIC PROPERTY Model AS CHARACTER NO-UNDO
        GET. PRIVATE SET.

    DEFINE PUBLIC PROPERTY MaxTokens AS INTEGER NO-UNDO
        GET. PRIVATE SET.

    DEFINE PUBLIC PROPERTY ChunkSizeChars AS INTEGER NO-UNDO
        GET. PRIVATE SET.

    /* ------------------------------------------------------------------ */
    /* Constructor                                                          */
    /* ------------------------------------------------------------------ */

    CONSTRUCTOR PUBLIC AppConfig():
        THIS-OBJECT:Load(CONFIG-FILE).
    END CONSTRUCTOR.

    CONSTRUCTOR PUBLIC AppConfig(INPUT pcConfigPath AS CHARACTER):
        THIS-OBJECT:Load(pcConfigPath).
    END CONSTRUCTOR.

    /* ------------------------------------------------------------------ */
    /* Private methods                                                      */
    /* ------------------------------------------------------------------ */

    METHOD PRIVATE VOID Load(INPUT pcPath AS CHARACTER):

        DEFINE VARIABLE cJson        AS CHARACTER          NO-UNDO.
        DEFINE VARIABLE oDoc         AS JsonDocument       NO-UNDO.
        DEFINE VARIABLE oRoot        AS JsonElement        NO-UNDO.
        DEFINE VARIABLE cAbsPath     AS CHARACTER          NO-UNDO.

        /* Resolve path relative to working directory if not absolute */
        IF NOT System.IO.Path:IsPathRooted(pcPath) THEN
            cAbsPath = System.IO.Path:Combine(THIS-OBJECT:WorkingDir(), pcPath).
        ELSE
            cAbsPath = pcPath.

        IF NOT File:Exists(cAbsPath) THEN
            UNDO, THROW NEW Progress.Lang.AppError(
                SUBSTITUTE("ProAnalog config file not found: &1~n~nCopy Config/proanalog.json.template to Config/proanalog.json and fill in your API details.", cAbsPath), 0).

        cJson = File:ReadAllText(cAbsPath).

        oDoc  = JsonDocument:Parse(cJson).
        oRoot = oDoc:RootElement.

        THIS-OBJECT:Provider       = THIS-OBJECT:GetString(oRoot, "provider",       "openai").
        THIS-OBJECT:ApiKey         = THIS-OBJECT:GetString(oRoot, "apiKey",          "").
        THIS-OBJECT:BaseUrl        = THIS-OBJECT:GetString(oRoot, "baseUrl",         "https://api.openai.com/v1").
        THIS-OBJECT:Model          = THIS-OBJECT:GetString(oRoot, "model",           "gpt-4o").
        THIS-OBJECT:MaxTokens      = THIS-OBJECT:GetInt   (oRoot, "maxTokens",       4096).
        THIS-OBJECT:ChunkSizeChars = THIS-OBJECT:GetInt   (oRoot, "chunkSizeChars",  80000).

        oDoc:Dispose().

    END METHOD.

    METHOD PRIVATE CHARACTER GetString(INPUT oEl  AS JsonElement,
                                       INPUT pcKey AS CHARACTER,
                                       INPUT pcDef AS CHARACTER):

        DEFINE VARIABLE oChild AS JsonElement NO-UNDO.

        IF oEl:TryGetProperty(pcKey, OUTPUT oChild) THEN
            RETURN oChild:GetString().

        RETURN pcDef.

    END METHOD.

    METHOD PRIVATE INTEGER GetInt(INPUT oEl  AS JsonElement,
                                  INPUT pcKey AS CHARACTER,
                                  INPUT piDef AS INTEGER):

        DEFINE VARIABLE oChild AS JsonElement NO-UNDO.

        IF oEl:TryGetProperty(pcKey, OUTPUT oChild) THEN
            RETURN oChild:GetInt32().

        RETURN piDef.

    END METHOD.

    METHOD PRIVATE CHARACTER WorkingDir():
        RETURN System.IO.Directory:GetCurrentDirectory().
    END METHOD.

END CLASS.
