/**
 * Perun RPC API
 * Perun Remote Procedure Calls Application Programming Interface
 *
 * The version of the OpenAPI document: 3.10.0
 * Contact: perun@cesnet.cz
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { ResourceTag } from './resourceTag';
import { Resource } from './resource';
import { Vo } from './vo';
import { Facility } from './facility';


export interface RichResource extends Resource { 
    vo?: Vo;
    facility?: Facility;
    resourceTags?: Array<ResourceTag>;
}

