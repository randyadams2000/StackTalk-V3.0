
        {/* Stripe Connection Section */}
        <Card className="mb-8 shadow-lg border-green-600/30 bg-gray-800">
          <CardHeader className="bg-green-900/20">
            <CardTitle className="flex items-center gap-2 text-green-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Connect Your Stripe Account to Receive Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
                Your fans will get 10 free minutes of access and then they will be asked to subscribe at $4.99/month. 
                You will receive $3.99 of that payment. We will distribute the payment monthly and we need you to connect 
                or add a Stripe account to receive payment.
              </p>
              <Button 
                size="lg" 
                className="bg-green-600 hover:bg-green-700 px-8"
              >
                Connect to Stripe
              </Button>
            </div>
          </CardContent>
        </Card>
