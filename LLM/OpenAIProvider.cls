/*------------------------------------------------------------------------
    File        : LLM/OpenAIProvider.cls
    Purpose     : ILLMProvider implementation for OpenAI-compatible APIs.
                  Covers OpenAI, Azure OpenAI, Ollama, and any other
                  provider that implements the /chat/completions endpoint.
    Syntax      : LLM.OpenAIProvider
    Notes       : Uses .NET System.Net.Http.HttpClient for HTTP calls and
                  System.Text.Json for request/response serialisation.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LLM.LLMMessage                        FROM PROPATH.
USING LLM.ILLMProvider                      FROM PROPATH.
USING System.Net.Http.HttpClient            FROM ASSEMBLY.
USING System.Net.Http.StringContent         FROM ASSEMBLY.
USING System.Net.Http.HttpRequestMessage    FROM ASSEMBLY.
USING System.Net.Http.HttpMethod            FROM ASSEMBLY.
USING System.Text.Json.JsonDocument         FROM ASSEMBLY.
USING System.Text.Json.JsonElement          FROM ASSEMBLY.
USING System.Text.Encoding                  FROM ASSEMBLY.

CLASS LLM.OpenAIProvider IMPLEMENTS ILLMProvider:

    DEFINE PRIVATE VARIABLE cBaseUrl  AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE cApiKey   AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE cModel    AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE oClient   AS HttpClient NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC OpenAIProvider(INPUT pcBaseUrl AS CHARACTER,
                                      INPUT pcApiKey  AS CHARACTER,
                                      INPUT pcModel   AS CHARACTER):
        cBaseUrl = pcBaseUrl.
        cApiKey  = pcApiKey.
        cModel   = pcModel.
        oClient  = NEW HttpClient().
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER SendMessages(INPUT poMessages  AS LLMMessage EXTENT,
                                         INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cEndpoint AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cBody     AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cResponse AS CHARACTER NO-UNDO.
        DEFINE VARIABLE oContent  AS StringContent NO-UNDO.
        DEFINE VARIABLE oRequest  AS HttpRequestMessage NO-UNDO.
        DEFINE VARIABLE oDoc      AS JsonDocument NO-UNDO.
        DEFINE VARIABLE oRoot     AS JsonElement  NO-UNDO.
        DEFINE VARIABLE oChoices  AS JsonElement  NO-UNDO.
        DEFINE VARIABLE oFirst    AS JsonElement  NO-UNDO.
        DEFINE VARIABLE oMsg      AS JsonElement  NO-UNDO.
        DEFINE VARIABLE i         AS INTEGER      NO-UNDO.

        cEndpoint = TRIM(cBaseUrl, "/") + "/chat/completions".
        cBody     = THIS-OBJECT:BuildRequestBody(poMessages, piMaxTokens).

        oContent = NEW StringContent(cBody, Encoding:UTF8, "application/json").
        oRequest = NEW HttpRequestMessage(HttpMethod:Post, cEndpoint).
        oRequest:Content = oContent.
        oRequest:Headers:Add("Authorization", "Bearer " + cApiKey).

        DEFINE VARIABLE oTask AS System.Threading.Tasks.Task NO-UNDO.
        DEFINE VARIABLE oHttpResponse AS System.Net.Http.HttpResponseMessage NO-UNDO.

        oTask         = oClient:SendAsync(oRequest).
        oTask:Wait().
        oHttpResponse = CAST(oTask:Result, System.Net.Http.HttpResponseMessage).

        IF NOT oHttpResponse:IsSuccessStatusCode THEN DO:
            DEFINE VARIABLE oErrTask AS System.Threading.Tasks.Task NO-UNDO.
            DEFINE VARIABLE cErrBody AS CHARACTER NO-UNDO.
            oErrTask = oHttpResponse:Content:ReadAsStringAsync().
            oErrTask:Wait().
            cErrBody = oErrTask:Result:ToString().
            UNDO, THROW NEW Progress.Lang.AppError(
                SUBSTITUTE("OpenAI API error &1: &2",
                    INTEGER(oHttpResponse:StatusCode), cErrBody), 0).
        END.

        DEFINE VARIABLE oRespTask AS System.Threading.Tasks.Task NO-UNDO.
        oRespTask = oHttpResponse:Content:ReadAsStringAsync().
        oRespTask:Wait().
        cResponse = oRespTask:Result:ToString().

        /* Parse: choices[0].message.content */
        oDoc     = JsonDocument:Parse(cResponse).
        oRoot    = oDoc:RootElement.
        oChoices = oRoot:GetProperty("choices").
        oFirst   = oChoices[0].
        oMsg     = oFirst:GetProperty("message").
        cResponse = oMsg:GetProperty("content"):GetString().

        oDoc:Dispose().

        RETURN cResponse.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetLabel():
        RETURN SUBSTITUTE("OpenAI / &1", cModel).
    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER BuildRequestBody(INPUT poMessages  AS LLMMessage EXTENT,
                                              INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cJson AS CHARACTER NO-UNDO.
        DEFINE VARIABLE i     AS INTEGER   NO-UNDO.
        DEFINE VARIABLE iLast AS INTEGER   NO-UNDO.

        iLast = EXTENT(poMessages).

        cJson = SUBSTITUTE('~{"model":"&1","max_tokens":&2,"messages":[',
                    cModel, piMaxTokens).

        DO i = 1 TO iLast:
            cJson = cJson +
                SUBSTITUTE('~{"role":"&1","content":"&2"~}',
                    poMessages[i]:Role,
                    THIS-OBJECT:EscapeJson(poMessages[i]:Content)).
            IF i < iLast THEN cJson = cJson + ",".
        END.

        cJson = cJson + "]}".

        RETURN cJson.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Minimal JSON string escaping for message content.                  */
    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER EscapeJson(INPUT pcText AS CHARACTER):

        pcText = REPLACE(pcText, "~\",  "~\~\").
        pcText = REPLACE(pcText, '"',   '~\"').
        pcText = REPLACE(pcText, "~n",  "\n").
        pcText = REPLACE(pcText, "~r",  "\r").
        pcText = REPLACE(pcText, "~t",  "\t").

        RETURN pcText.

    END METHOD.

    /*--------------------------------------------------------------------*/

    DESTRUCTOR PUBLIC OpenAIProvider():
        IF VALID-OBJECT(oClient) THEN oClient:Dispose().
    END DESTRUCTOR.

END CLASS.
