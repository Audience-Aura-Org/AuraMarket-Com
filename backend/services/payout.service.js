/**
 * Payout Service
 * Handles interactions with Eversend API for mobile money payouts.
 */

class PayoutService {
  constructor() {
    this.isSimulation = process.env.NODE_ENV !== 'production' || process.env.SIMULATE_PAYOUTS === 'true';
    this.apiKey = process.env.EVERSEND_API_KEY;
  }

  /**
   * Triggers a mobile money payout via Eversend
   * @param {number} amount - Amount in XAF
   * @param {string} phone - Recipient phone number
   * @param {string} provider - 'mtn' or 'orange'
   * @returns {Promise<object>} - Response from gateway
   */
  async triggerMobilePayout(amount, phone, provider) {
    console.log(`[PayoutService] Initiating ${provider} payout: ${amount} XAF to ${phone}`);

    if (this.isSimulation) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 95% success rate for simulation
      if (Math.random() > 0.05) {
        return {
          success: true,
          reference: `EVR-SIM-${Math.random().toString(36).substring(7).toUpperCase()}`,
          message: 'Simulation: Payout successful'
        };
      } else {
        throw new Error('Simulation: Gateway timeout');
      }
    }

    // Real Eversend Integration would go here
    // Example:
    // const response = await axios.post('https://api.eversend.com/v1/payouts', { ... });
    // return response.data;
    
    throw new Error('Real Eversend integration not yet configured.');
  }
}

module.exports = new PayoutService();
