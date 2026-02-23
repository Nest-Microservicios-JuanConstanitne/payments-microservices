import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { envs } from '../config/envs';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {

  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map(item => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name
          },
          unit_amount: Math.round(item.price * 100) // 20 dolares  200 / 100 = 20.00 VALOR EN ENTERO\
        },
        quantity: item.quantity
      }
    });

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId: orderId
        },
      },

      line_items: lineItems,
      mode: 'payment',
      success_url: 'http://localhost:3003/payments/success',
      cancel_url: 'http://localhost:3003/payments/cancel',
    });

    return session;

  }

  async stripeWebhook(req: Request, res: Response) {

    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    const endpointSecret = 'whsec_8EjdzblHd91ngu27KZ4BknHhRFFUKkhF';

    //const endpointSecret = 'whsec_63b159adefb1a95529e5f5b3737f0756422e8b687268e26d8b576ae2532c360d';

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'], // 👈 ahora sí existe
        sig,
        endpointSecret,
      );

    } catch (err) {
      console.log(err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log({ event });

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object as Stripe.Charge;

        /* console.log({
          metadata: chargeSucceeded.metadata,
          orderId: chargeSucceeded.metadata.orderId,
        }); */
        break;

      default:
        console.log(`Event ${event.type} not handled`);
    }

    return res.status(200).json({ received: true });
  }

}
