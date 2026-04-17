/*------------------------------------------------------------------------
    File        : LLM/ILLMProvider.cls
    Purpose     : Interface defining the contract for all LLM provider
                  implementations. The rest of the application depends
                  only on this interface, never on concrete providers.
    Syntax      : LLM.ILLMProvider
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LLM.LLMMessage FROM PROPATH.

INTERFACE LLM.ILLMProvider:

    /*--------------------------------------------------------------------*/
    /* Send a list of messages to the LLM and return the response text.  */
    /* poMessages[1] is typically the system prompt.                      */
    /* Raises Progress.Lang.AppError on network or API errors.            */
    /*--------------------------------------------------------------------*/
    METHOD PUBLIC CHARACTER SendMessages(INPUT poMessages  AS LLMMessage EXTENT,
                                         INPUT piMaxTokens AS INTEGER).

    /*--------------------------------------------------------------------*/
    /* Returns a human-readable label for the provider and model,        */
    /* e.g. "OpenAI / gpt-4o" — used in the status bar.                  */
    /*--------------------------------------------------------------------*/
    METHOD PUBLIC CHARACTER GetLabel().

END INTERFACE.
