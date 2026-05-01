/**
 * String similarity calculation utilities
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param a First string
 * @param b Second string
 * @returns Levenshtein edit distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity between two strings (0-1 scale)
 * @param a First string
 * @param b Second string
 * @returns Similarity score (1 = identical, 0 = completely different)
 */
export function calculateStringSimilarity(a: string, b: string): number {
  // Case insensitive comparison
  const strA = a.toLowerCase();
  const strB = b.toLowerCase();
  
  // Handle exact matches and empty strings
  if (strA === strB) return 1.0;
  if (strA.length === 0 || strB.length === 0) return 0.0;
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(strA, strB);
  
  // Normalize the distance to a similarity score between 0 and 1
  // The max possible distance is the length of the longer string
  const maxLength = Math.max(strA.length, strB.length);
  return 1 - distance / maxLength;
}

/**
 * Check if two strings are considered equivalent based on similarity threshold
 * @param a First string
 * @param b Second string
 * @param threshold Similarity threshold (0-1)
 * @returns True if strings are considered equivalent
 */
export function areStringsEquivalent(a: string, b: string, threshold: number = 0.8): boolean {
  return calculateStringSimilarity(a, b) >= threshold;
}