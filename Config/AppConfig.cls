/*------------------------------------------------------------------------
    File        : Config/AppConfig.cls
    Purpose     : Reads Config/proanalog.json and exposes configuration
                  values to the rest of the application.
    Syntax      : Config.AppConfig
    Notes       : Uses Progress.Json.ObjectModel for JSON parsing.
                  Config file is resolved via FILE-INFO then SEARCH(),
                  so it can be found relative to the working directory
                  or anywhere on the PROPATH.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING Progress.Json.ObjectModel.ObjectModelParser FROM PROPATH.
USING Progress.Json.ObjectModel.JsonObject        FROM PROPATH.

CLASS Config.AppConfig:

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
    /* Constructors                                                         */
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

        DEFINE VARIABLE oParser   AS ObjectModelParser NO-UNDO.
        DEFINE VARIABLE oDoc      AS JsonObject        NO-UNDO.
        DEFINE VARIABLE cFullPath AS CHARACTER         NO-UNDO.

        /* Resolve the config file — try as-is first, then via SEARCH() */
        FILE-INFO:FILE-NAME = pcPath.
        cFullPath = FILE-INFO:FULL-PATHNAME.

        IF cFullPath = ? THEN
            cFullPath = SEARCH(pcPath).

        IF cFullPath = ? OR cFullPath = "" THEN
            UNDO, THROW NEW Progress.Lang.AppError(
                SUBSTITUTE("ProAnalog config file not found: &1~n~nCopy Config/proanalog.json.template to Config/proanalog.json and fill in your API details.", pcPath), 0).

        oParser = NEW ObjectModelParser().
        oDoc    = CAST(oParser:ParseFile(cFullPath), JsonObject).

        THIS-OBJECT:Provider       = THIS-OBJECT:GetString(oDoc, "provider",       "openai").
        THIS-OBJECT:ApiKey         = THIS-OBJECT:GetString(oDoc, "apiKey",          "").
        THIS-OBJECT:BaseUrl        = THIS-OBJECT:GetString(oDoc, "baseUrl",         "https://api.openai.com/v1").
        THIS-OBJECT:Model          = THIS-OBJECT:GetString(oDoc, "model",           "gpt-4o").
        THIS-OBJECT:MaxTokens      = THIS-OBJECT:GetInt   (oDoc, "maxTokens",       4096).
        THIS-OBJECT:ChunkSizeChars = THIS-OBJECT:GetInt   (oDoc, "chunkSizeChars",  80000).

    END METHOD.

    METHOD PRIVATE CHARACTER GetString(INPUT oObj AS JsonObject,
                                       INPUT pcKey AS CHARACTER,
                                       INPUT pcDef AS CHARACTER):
        IF oObj:Has(pcKey) THEN
            RETURN oObj:GetCharacter(pcKey).
        RETURN pcDef.
    END METHOD.

    METHOD PRIVATE INTEGER GetInt(INPUT oObj AS JsonObject,
                                  INPUT pcKey AS CHARACTER,
                                  INPUT piDef AS INTEGER):
        IF oObj:Has(pcKey) THEN
            RETURN oObj:GetInteger(pcKey).
        RETURN piDef.
    END METHOD.

END CLASS.
