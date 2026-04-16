/*------------------------------------------------------------------------
    File        : LLM/AnthropicProvider.cls
    Purpose     : ILLMProvider implementation for the Anthropic Messages
                  API (Claude models).
    Syntax      : LLM.AnthropicProvider
    Notes       : Key differences from OpenAI:
                    - Auth: x-api-key header + anthropic-version header
                    - System prompt is a top-level field, not a message
                    - Response path: content[0].text
                    - max_tokens is required
                  Uses .NET System.Net.Http and System.Text.Json.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LLM.LLMMessage                        FROM ANYWHERE.
USING LLM.ILLMProvider                      FROM ANYWHERE.
USING System.Net.Http.HttpClient            FROM ASSEMBLY.
USING System.Net.Http.StringContent         FROM ASSEMBLY.
USING System.Net.Http.HttpRequestMessage    FROM ASSEMBLY.
USING System.Net.Http.HttpMethod            FROM ASSEMBLY.
USING System.Text.Json.JsonDocument         FROM ASSEMBLY.
USING System.Text.Json.JsonElement          FROM ASSEMBLY.
USING System.Text.Encoding                  FROM ASSEMBLY.

CLASS LLM.AnthropicProvider IMPLEMENTS ILLMProvider:

    DEFINE PRIVATE STATIC VARIABLE ANTHROPIC-VERSION AS CHARACTER
        INITIAL "2023-06-01" NO-UNDO.

    DEFINE PRIVATE VARIABLE cBaseUrl  AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE cApiKey   AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE cModel    AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE oClient   AS HttpClient NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC AnthropicProvider(INPUT pcBaseUrl AS CHARACTER,
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

        DEFINE VARIABLE cEndpoint     AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cBody         AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cResponse     AS CHARACTER NO-UNDO.
        DEFINE VARIABLE oContent      AS StringContent NO-UNDO.
        DEFINE VARIABLE oRequest      AS HttpRequestMessage NO-UNDO.
        DEFINE VARIABLE oDoc          AS JsonDocument NO-UNDO.
        DEFINE VARIABLE oRoot         AS JsonElement  NO-UNDO.
        DEFINE VARIABLE oContentArr   AS JsonElement  NO-UNDO.
        DEFINE VARIABLE oFirst        AS JsonElement  NO-UNDO.

        cEndpoint = TRIM(cBaseUrl, "/") + "/messages".
        cBody     = THIS-OBJECT:BuildRequestBody(poMessages, piMaxTokens).

        oContent = NEW StringContent(cBody, Encoding:UTF8, "application/json").
        oRequest = NEW HttpRequestMessage(HttpMethod:Post, cEndpoint).
        oRequest:Content = oContent.
        oRequest:Headers:Add("x-api-key",         cApiKey).
        oRequest:Headers:Add("anthropic-version",  ANTHROPIC-VERSION).

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
                SUBSTITUTE("Anthropic API error &1: &2",
                    INTEGER(oHttpResponse:StatusCode), cErrBody), 0).
        END.

        DEFINE VARIABLE oRespTask AS System.Threading.Tasks.Task NO-UNDO.
        oRespTask = oHttpResponse:Content:ReadAsStringAsync().
        oRespTask:Wait().
        cResponse = oRespTask:Result:ToString().

        /* Parse: content[0].text */
        oDoc        = JsonDocument:Parse(cResponse).
        oRoot       = oDoc:RootElement.
        oContentArr = oRoot:GetProperty("content").
        oFirst      = oContentArr[0].
        cResponse   = oFirst:GetProperty("text"):GetString().

        oDoc:Dispose().

        RETURN cResponse.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetLabel():
        RETURN SUBSTITUTE("Anthropic / &1", cModel).
    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Anthropic keeps the system prompt as a top-level field; only       */
    /* user/assistant messages go in the messages array.                  */
    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER BuildRequestBody(INPUT poMessages  AS LLMMessage EXTENT,
                                              INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cJson       AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cSystem     AS CHARACTER NO-UNDO.
        DEFINE VARIABLE i           AS INTEGER   NO-UNDO.
        DEFINE VARIABLE iLast       AS INTEGER   NO-UNDO.
        DEFINE VARIABLE lFirstMsg   AS LOGICAL   NO-UNDO INITIAL TRUE.

        iLast = EXTENT(poMessages).

        /* Extract system message (role = "system") */
        DO i = 1 TO iLast:
            IF poMessages[i]:Role = "system" THEN DO:
                cSystem = THIS-OBJECT:EscapeJson(poMessages[i]:Content).
                LEAVE.
            END.
        END.

        cJson = SUBSTITUTE('~{"model":"&1","max_tokens":&2,"system":"&3","messages":[',
                    cModel, piMaxTokens, cSystem).

        DO i = 1 TO iLast:
            IF poMessages[i]:Role = "system" THEN NEXT.

            IF NOT lFirstMsg THEN cJson = cJson + ",".
            cJson = cJson +
                SUBSTITUTE('~{"role":"&1","content":"&2"~}',
                    poMessages[i]:Role,
                    THIS-OBJECT:EscapeJson(poMessages[i]:Content)).
            lFirstMsg = FALSE.
        END.

        cJson = cJson + "]}".

        RETURN cJson.

    END METHOD.

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

    DESTRUCTOR PUBLIC AnthropicProvider():
        IF VALID-OBJECT(oClient) THEN oClient:Dispose().
    END DESTRUCTOR.

END CLASS.
