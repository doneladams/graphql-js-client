/* eslint-disable no-new */
import assert from 'assert';
import assertDeeplyFrozen from './assert-deeply-frozen';
import SelectionSet, {FragmentDefinition} from '../src/selection-set';
import typeBundle from '../fixtures/types'; // eslint-disable-line import/no-unresolved
import variable from '../src/variable';

suite('selection-set-test', () => {
  const querySplitter = /[\s,]+/;

  function tokens(query) {
    return query.split(querySplitter).filter((token) => Boolean(token));
  }

  test('it builds sets using the passed type', () => {
    const set = new SelectionSet(typeBundle, 'Shop');

    assert.deepEqual(typeBundle.types.Shop, set.typeSchema);
    assert.deepEqual(tokens(set.toString()), tokens(' { }'));
  });

  test('it can add basic fields', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name');
    });

    assert.deepEqual(tokens(set.toString()), tokens(' { name }'));
  });

  test('add can take Field or InlineFragment objects directly', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add(shop.inlineFragmentOn('Shop', (fragment) => {
        fragment.add(shop.field('name'));
      }));
    });

    assert.deepEqual(tokens(set.toString()), tokens(' { ... on Shop { name } }'));
  });

  test('it can add named fragments', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name');
    });

    const fragment = new FragmentDefinition('sickFragment', 'Shop', set);

    const setWithFragment = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add(fragment.spread);
    });

    assert.deepEqual(tokens(setWithFragment.toString()), tokens('{ ...sickFragment }'));
  });

  test('it can add named fragments through "add"', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name');
    });

    const fragment = new FragmentDefinition('sickFragment', 'Shop', set);

    const setWithFragment = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add(fragment.spread);
    });

    assert.deepEqual(tokens(setWithFragment.toString()), tokens('{ ...sickFragment }'));
  });

  test('add yields an instance of SelectionSetBuilder representing the type of the field', () => {
    let shopBuilder = null;

    new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('shop', (shop) => {
        shopBuilder = shop;
      });
    });
    assert.equal(typeBundle, shopBuilder.typeBundle);
    assert.equal(typeBundle.types.Shop, shopBuilder.typeSchema);
  });

  test('it doesn\'t require field args when using add or addConnection', () => {
    let addCalledCallBack = false;

    new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('shop', () => {
        addCalledCallBack = true;
      });
    });

    assert.ok(addCalledCallBack, 'add called callback even if args wasn\'t passed');
  });

  test('it doesn\'t require query args when using addConnection', () => {
    let addConnectionCalledCallBack = false;

    new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.addConnection('collections', () => {
        addConnectionCalledCallBack = true;
      });
    });

    assert.ok(addConnectionCalledCallBack, 'addConnection called callback even if args wasn\'t passed');
  });

  test('it composes nested querys', () => {
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('shop', (shop) => {
        shop.add('name');
      });
    });

    assert.deepEqual(tokens(set.toString()), tokens(' { shop { name } }'));
  });

  test('it can attach args to nested nodes', () => {
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('product', {args: {id: '1'}}, (product) => {
        product.add('title');
      });
    });

    assert.deepEqual(tokens(set.toString()), tokens(' { product (id: "1") { id, title } }'));
  });

  test('it adds connections with pagination info', () => {
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('shop', (shop) => {
        shop.add('name');
        shop.addConnection('products', {args: {first: 10}}, (product) => {
          product.add('handle');
        });
      });
    });

    assert.deepEqual(tokens(set.toString()), tokens(` {
      shop {
        name,
        products (first: 10) {
          pageInfo {
            hasNextPage,
            hasPreviousPage
          },
          edges {
            cursor,
            node {
              id
              handle
            }
          }
        }
      }
    }`));
  });

  test('it adds inline fragments', () => {
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('shop', (shop) => {
        shop.addInlineFragmentOn('Shop', (fragment) => {
          fragment.add('name');
        });
      });
    });

    assert.deepEqual(tokens(set.toString()), tokens(`{
      shop {
        ... on Shop {
          name
        }
      }
    }`));
  });

  test('it cannot add the same field twice', () => {
    assert.throws(
      () => {
        new SelectionSet(typeBundle, 'QueryRoot', (root) => {
          root.add('shop', (shop) => {
            shop.add('name');
            shop.add('name');
          });
        });
      },
      /The field name or alias 'name' has already been added/
    );
  });

  test('it cannot use the same alias twice', () => {
    assert.throws(
      () => {
        new SelectionSet(typeBundle, 'QueryRoot', (root) => {
          root.add('shop', (shop) => {
            shop.add('name', {alias: 'theNameOfTheShop'});
            shop.add('name', {alias: 'theNameOfTheShop'});
          });
        });
      },
      /The field name or alias 'theNameOfTheShop' has already been added/
    );
  });

  test('it cannot add an alias with the same name as a field', () => {
    assert.throws(
      () => {
        new SelectionSet(typeBundle, 'QueryRoot', (root) => {
          root.add('shop', (shop) => {
            shop.add('name');
            shop.add('description', {alias: 'name'});
          });
        });
      },
      /The field name or alias 'name' has already been added/
    );
  });

  test('it cannot add a field with the same name as an alias', () => {
    assert.throws(
      () => {
        new SelectionSet(typeBundle, 'QueryRoot', (root) => {
          root.add('shop', (shop) => {
            shop.add('description', {alias: 'name'});
            shop.add('name');
          });
        });
      },
      /The field name or alias 'name' has already been added/
    );
  });

  test('it can add a field with SelectionSet', () => {
    const shopSelectionSet = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name');
      shop.addConnection('products', {args: {first: 10}}, (products) => {
        products.add('handle');
      });
    });
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('shop', shopSelectionSet);
    });

    assert.deepEqual(tokens(set.toString()), tokens(` {
      shop {
        name
        products (first: 10) {
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
          edges {
            cursor,
            node {
              id
              handle
            }
          }
        }
      }
    }`));
  });

  test('it can add a field with SelectionSet using args', () => {
    const productConnection = new SelectionSet(typeBundle, 'ProductConnection', (connection) => {
      connection.add('pageInfo', (pageInfo) => {
        pageInfo.add('hasNextPage');
        pageInfo.add('hasPreviousPage');
      });
    });
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('products', {args: {first: 10}}, productConnection);
    });

    assert.deepEqual(tokens(set.toString()), tokens(` {
      products (first: 10) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`));
  });

  test('it can add a field with an alias', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name', {alias: 'theNameOfTheShop'});
    });

    assert.deepEqual(tokens(set.toString()), tokens('{ theNameOfTheShop: name }'));
  });

  test('it can add fields with the same name, but different aliases', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name', {alias: 'theNameOfTheShop'});
      shop.add('name', {alias: 'alsoTheNameOfTheShop'});
    });

    assert.deepEqual(tokens(set.toString()), tokens('{ theNameOfTheShop: name, alsoTheNameOfTheShop: name }'));
  });

  test('field.responseKey === field.alias when alias is present', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name', {alias: 'theNameOfTheShop'});
    });

    assert.equal(set.selections[0].responseKey, 'theNameOfTheShop');
  });

  test('field.responseKey === field.name when alias is not present', () => {
    const set = new SelectionSet(typeBundle, 'Shop', (shop) => {
      shop.add('name');
    });

    assert.equal(set.selections[0].responseKey, 'name');
  });

  test('selection sets are deeply frozen once they\'ve been built', () => {
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('node', {args: {id: variable('productId', 'ID!')}}, (node) => {
        node.addInlineFragmentOn('Product', (product) => {
          product.add('title');
        });
      });
    });

    assertDeeplyFrozen(set);
  });

  test('adding field arguments defensively copies the arguments, except for the variables which are re-used', () => {
    const args = {fakeArg: {nestedVariable: variable('foo', 'String')}};
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('product', {args});
    });

    assert.deepEqual(set.selections[0].args, args);
    assert.notEqual(set.selections[0].args, args);
    assert.notEqual(set.selections[0].args.fakeArg, args.fakeArg);
    assert.equal(set.selections[0].args.fakeArg.nestedVariable, args.fakeArg.nestedVariable);
  });

  test('it throws an informative error if the field does not exist in the schema', () => {
    assert.throws(() => {
      new SelectionSet(typeBundle, 'QueryRoot', (root) => {
        root.add('shop', (shop) => {
          shop.add('spaghetti');
        });
      });
    }, /No field of name "spaghetti" found on type "Shop" in schema/);
  });

  test('it can add enum fields', () => {
    const set = new SelectionSet(typeBundle, 'QueryRoot', (root) => {
      root.add('product', (product) => {
        product.addConnection('variants', (variant) => {
          variant.add('weightUnit'); // enum field
        });
      });
    });

    assert.deepEqual(tokens(set.toString()), tokens(`{
      product {
        id,
        variants {
          pageInfo {
            hasNextPage,
            hasPreviousPage
          },
          edges {
            cursor,
            node {
              id,
              weightUnit
            }
          }
        }
      }
    }`));
  });
});
