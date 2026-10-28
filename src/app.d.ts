declare namespace App {
  interface PageState {
    /**
     * The search page was opened from another of the explorer's pages, the
     * one before it in the history: closing its notice goes back there.
     */
    searchedInApp?: boolean;
  }
}
