/*------------------------------------------------------------------------
    File        : LLM/LLMMessage.cls
    Purpose     : Simple data class representing a single message in an
                  LLM conversation. Role is "system", "user", or
                  "assistant".
    Syntax      : LLM.LLMMessage
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

CLASS LLM.LLMMessage:

    DEFINE PUBLIC PROPERTY Role    AS CHARACTER NO-UNDO GET. PRIVATE SET.
    DEFINE PUBLIC PROPERTY Content AS CHARACTER NO-UNDO GET. PRIVATE SET.

    CONSTRUCTOR PUBLIC LLMMessage(INPUT pcRole    AS CHARACTER,
                                  INPUT pcContent AS CHARACTER):
        THIS-OBJECT:Role    = pcRole.
        THIS-OBJECT:Content = pcContent.
    END CONSTRUCTOR.

END CLASS.
